import { describe, it, expect } from '@jest/globals';
import { planActions, buildCallNote, nextDay, buildFinancialHints } from './actionPlanner.js';
import { normalizeAnalysis } from './analysisService.js';
import { ACTION_STATUS, AUTO_APPLICABLE_TOOLS, PROPOSABLE_TOOLS, ENTITY_TYPE } from './constants.js';

const CALL_DATE = '2026-08-09';

function analysis(overrides = {}) {
  return normalizeAnalysis({
    summary: 'Customer wants a 2BHK in Thane within 3 months.',
    keyPoints: ['Budget 1.5 Cr', 'Prefers Thane or Mulund'],
    topics: ['budget', 'property_requirement'],
    intentLevel: 'HIGH',
    requirements: { propertyType: 'apartment', bhk: '2BHK', budgetMax: 15000000, locations: ['Thane'] },
    ...overrides,
  });
}

const leadMatch = { entityType: ENTITY_TYPE.LEAD, entityId: 'lead-123', name: 'Rahul' };
const tenantMatch = { entityType: ENTITY_TYPE.TENANT, entityId: 'tenant-9', name: 'Priya' };

describe('planActions', () => {
  it('always logs a note on the matched record', () => {
    const actions = planActions({ analysis: analysis(), match: leadMatch, callDate: CALL_DATE, recordingId: 'rec-1' });
    const note = actions.find((a) => a.tool === 'create_lead_note');
    expect(note).toBeDefined();
    expect(note.arguments.leadId).toBe('lead-123');
    expect(note.arguments.content).toContain('Customer wants a 2BHK');
    expect(note.requiresApproval).toBe(false);
  });

  it('requires approval for the note when auto-apply is disabled', () => {
    const actions = planActions({
      analysis: analysis(), match: leadMatch, callDate: CALL_DATE, autoApplyNotes: false,
    });
    expect(actions.find((a) => a.tool === 'create_lead_note').requiresApproval).toBe(true);
  });

  it('uses the tenant note tool and id argument for a tenant match', () => {
    const actions = planActions({ analysis: analysis(), match: tenantMatch, callDate: CALL_DATE });
    const note = actions.find((a) => a.tool === 'create_tenant_note');
    expect(note.arguments.tenantRecordId).toBe('tenant-9');
  });

  it('proposes a lead update with requirements and status', () => {
    const actions = planActions({
      analysis: analysis({ suggestedLeadStatus: 'qualified' }),
      match: leadMatch,
      callDate: CALL_DATE,
    });
    const update = actions.find((a) => a.tool === 'update_lead');
    expect(update.arguments.leadId).toBe('lead-123');
    expect(update.arguments.status).toBe('qualified');
    expect(update.arguments.buyerRequirement.budget).toBe(15000000);
    expect(update.arguments.buyerRequirement.bhk).toBe('2BHK');
    expect(update.requiresApproval).toBe(true);
  });

  it('ignores an invalid status suggested by the model', () => {
    const actions = planActions({
      analysis: analysis({ suggestedLeadStatus: 'super-hot' }),
      match: leadMatch,
      callDate: CALL_DATE,
    });
    const update = actions.find((a) => a.tool === 'update_lead');
    expect(update?.arguments?.status).toBeUndefined();
  });

  it('schedules a site visit on the requested date', () => {
    const actions = planActions({
      analysis: analysis({ siteVisit: { requested: true, preferredDate: '2026-08-15', preferredTime: '16:00' } }),
      match: leadMatch,
      callDate: CALL_DATE,
    });
    const visit = actions.find((a) => a.title === 'Schedule site visit');
    expect(visit.tool).toBe('create_meeting');
    expect(visit.arguments.scheduledDate).toBe('2026-08-15T16:00');
    expect(visit.arguments.relatedEntityType).toBe('lead');
    expect(visit.requiresApproval).toBe(true);
  });

  it('falls back to a default slot when the site visit date was not stated', () => {
    const actions = planActions({
      analysis: analysis({ siteVisit: { requested: true } }),
      match: leadMatch,
      callDate: CALL_DATE,
    });
    const visit = actions.find((a) => a.title === 'Schedule site visit');
    expect(visit.arguments.scheduledDate).toBe('2026-08-11T11:00');
    expect(visit.description).toContain('please confirm');
  });

  it('proposes an approval-gated visit when painting work is discussed', () => {
    const actions = planActions({
      analysis: analysis({
        topics: ['painting_whitewash'],
        maintenance: { required: true, workType: 'painting', description: 'Repaint 2 bedrooms', estimatedCost: 25000 },
      }),
      match: tenantMatch,
      callDate: CALL_DATE,
    });
    const maintenance = actions.find((a) => a.title.includes('painting'));
    expect(maintenance).toBeDefined();
    expect(maintenance.tool).toBe('create_meeting');
    expect(maintenance.requiresApproval).toBe(true);
    expect(maintenance.arguments.notes).toContain('Repaint 2 bedrooms');
    expect(maintenance.description).toContain('25,000');
  });

  it('detects maintenance from the topic list even without a maintenance block', () => {
    const actions = planActions({
      analysis: analysis({ topics: ['repairs'] }),
      match: tenantMatch,
      callDate: CALL_DATE,
    });
    expect(actions.some((a) => a.title.includes('work visit'))).toBe(true);
  });

  it('proposes creating a lead when nothing matched', () => {
    const actions = planActions({
      analysis: analysis({ isNewLead: true, customer: { name: 'Amit' }, counterpartyRole: 'buyer' }),
      match: null,
      callDate: CALL_DATE,
      phone: '9876543210',
    });
    const create = actions.find((a) => a.tool === 'create_lead');
    expect(create.arguments.name).toBe('Amit');
    expect(create.arguments.leadType).toBe('buyer');
    expect(create.arguments.phone).toBe('9876543210');
    expect(create.arguments.buyerRequirement.budget).toBe(15000000);
    expect(create.requiresApproval).toBe(true);
  });

  it('never writes notes when there is no matched record', () => {
    const actions = planActions({ analysis: analysis(), match: null, callDate: CALL_DATE, phone: '9876543210' });
    expect(actions.some((a) => a.tool.endsWith('_note'))).toBe(false);
  });

  it('treats an unmatched match object as no match', () => {
    const actions = planActions({
      analysis: analysis(),
      match: { entityType: ENTITY_TYPE.UNMATCHED, entityId: null },
      callDate: CALL_DATE,
    });
    expect(actions.some((a) => a.tool.endsWith('_note'))).toBe(false);
  });

  it('schedules a follow-up when one was promised', () => {
    const actions = planActions({
      analysis: analysis({ followUp: { required: true, date: '2026-08-12', time: '10:30', reason: 'Send options' } }),
      match: leadMatch,
      callDate: CALL_DATE,
    });
    const followUp = actions.find((a) => a.title === 'Schedule follow-up');
    expect(followUp.arguments.scheduledDate).toBe('2026-08-12T10:30');
  });

  it('only ever emits allow-listed tools, and never auto-applies a write', () => {
    const actions = planActions({
      analysis: analysis({
        siteVisit: { requested: true },
        followUp: { required: true },
        maintenance: { required: true, workType: 'painting' },
        suggestedLeadStatus: 'negotiating',
      }),
      match: leadMatch,
      callDate: CALL_DATE,
    });

    expect(actions.length).toBeGreaterThan(3);
    for (const action of actions) {
      expect(PROPOSABLE_TOOLS).toContain(action.tool);
      expect(action.status).toBe(ACTION_STATUS.PENDING);
      expect(action.actionId).toBeTruthy();
      if (!action.requiresApproval) {
        expect(AUTO_APPLICABLE_TOOLS).toContain(action.tool);
      }
    }
  });

  it('produces no actions for an empty analysis with no match', () => {
    const actions = planActions({ analysis: normalizeAnalysis({}), match: null, callDate: CALL_DATE, phone: null });
    expect(actions).toEqual([]);
  });
});

describe('buildCallNote', () => {
  it('includes the summary, key points and requirement line', () => {
    const note = buildCallNote(analysis(), {
      callDate: CALL_DATE,
      durationSeconds: 185,
      language: 'hinglish',
      recordingId: 'rec-42',
    });
    expect(note).toContain('Call summary (AI) — 2026-08-09');
    expect(note).toContain('3m 5s');
    expect(note).toContain('• Budget 1.5 Cr');
    expect(note).toContain('Requirement: apartment · 2BHK · Thane · ₹1,50,00,000');
    expect(note).toContain('rec-42');
  });
});

describe('nextDay', () => {
  it('advances by the requested number of days', () => {
    expect(nextDay('2026-08-09', 1)).toBe('2026-08-10');
    expect(nextDay('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('falls back to today for an invalid input', () => {
    expect(nextDay('not-a-date', 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('buildFinancialHints', () => {
  it('surfaces a khata hint without creating any action', () => {
    const hints = buildFinancialHints(analysis({
      payment: { discussed: true, direction: 'received', amount: 50000, dueDate: '2026-08-20' },
    }));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain('₹50,000');
    expect(hints[0]).toContain('Khata Book');
  });

  it('returns nothing when payment was not discussed', () => {
    expect(buildFinancialHints(analysis())).toEqual([]);
  });
});
