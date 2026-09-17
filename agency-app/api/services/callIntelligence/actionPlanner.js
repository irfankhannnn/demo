/**
 * Maps a normalized analysis to concrete CRM tool calls.
 *
 * This mapping is deterministic on purpose. The LLM reports what was said; the
 * rules here decide what the CRM may be asked to do. That keeps tool arguments
 * schema-valid and makes the behaviour unit-testable without an LLM.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ACTION_STATUS,
  AUTO_APPLICABLE_TOOLS,
  ENTITY_TYPE,
  ID_ARG_BY_ENTITY,
  MAINTENANCE_TOPICS,
  NOTE_TOOL_BY_ENTITY,
  PROPOSABLE_TOOLS,
} from './constants.js';

const DEFAULT_MEETING_TIME = process.env.CALL_INTEL_DEFAULT_MEETING_TIME || '11:00';

/** Lead types accepted by create_lead. */
const LEAD_TYPE_BY_ROLE = {
  buyer: 'buyer',
  tenant: 'tenant',
  owner: 'owner',
  lead: 'buyer',
};

function formatMoney(value) {
  if (value == null) return null;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

/** Next calendar day in YYYY-MM-DD, used when a follow-up has no explicit date. */
export function nextDay(fromIsoDate, days = 1) {
  const base = fromIsoDate ? new Date(`${fromIsoDate}T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date().toISOString().slice(0, 10);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Human-readable note body appended to the matched CRM record. */
export function buildCallNote(analysis, { callDate, durationSeconds, language, recordingId }) {
  const lines = [];
  lines.push(`📞 Call summary (AI) — ${callDate}`);

  if (durationSeconds) {
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.round(durationSeconds % 60);
    lines.push(`Duration: ${minutes}m ${seconds}s${language ? ` · Language: ${language}` : ''}`);
  }

  lines.push('');
  lines.push(analysis.summary || 'No summary available.');

  if (analysis.keyPoints?.length) {
    lines.push('');
    lines.push('Key points:');
    analysis.keyPoints.forEach((point) => lines.push(`• ${point}`));
  }

  const requirement = analysis.requirements || {};
  const requirementBits = [];
  if (requirement.propertyType) requirementBits.push(requirement.propertyType);
  if (requirement.bhk) requirementBits.push(requirement.bhk);
  if (requirement.locations?.length) requirementBits.push(requirement.locations.join(', '));
  if (requirement.budgetMax || requirement.budgetMin) {
    const min = formatMoney(requirement.budgetMin);
    const max = formatMoney(requirement.budgetMax);
    requirementBits.push(min && max && min !== max ? `₹${min}–₹${max}` : `₹${max || min}`);
  }
  if (requirementBits.length) {
    lines.push('');
    lines.push(`Requirement: ${requirementBits.join(' · ')}`);
  }

  if (analysis.objections?.length) {
    lines.push(`Concerns: ${analysis.objections.join(', ')}`);
  }
  if (analysis.intentLevel) {
    lines.push(`Intent: ${analysis.intentLevel}`);
  }
  if (analysis.topics?.length) {
    lines.push(`Topics: ${analysis.topics.join(', ')}`);
  }
  if (recordingId) {
    lines.push('');
    lines.push(`Source: call recording ${recordingId}`);
  }

  return lines.join('\n');
}

function makeAction({ tool, args, title, description, requiresApproval, reason }) {
  return {
    actionId: uuidv4(),
    tool,
    arguments: args,
    title,
    description: description || '',
    reason: reason || '',
    requiresApproval,
    status: ACTION_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    executedAt: null,
    executionResult: null,
    executionError: null,
  };
}

/**
 * Build the proposed action list for one analysed recording.
 *
 * @param {object} params
 * @param {object} params.analysis normalized analysis
 * @param {{entityType: string, entityId: string, name?: string}|null} params.match
 * @param {string} params.callDate YYYY-MM-DD
 * @param {string} params.recordingId
 * @param {number|null} params.durationSeconds
 * @param {string|null} params.phone
 * @param {boolean} params.autoApplyNotes
 * @returns {object[]} proposed actions
 */
export function planActions({
  analysis,
  match = null,
  callDate = new Date().toISOString().slice(0, 10),
  recordingId = '',
  durationSeconds = null,
  phone = null,
  autoApplyNotes = true,
}) {
  const actions = [];
  const matched = match && match.entityType && match.entityType !== ENTITY_TYPE.UNMATCHED && match.entityId
    ? match
    : null;

  // 1. Call summary as a note on the matched record (the agency owner asked for
  //    every call to be written back somewhere).
  if (matched) {
    const noteTool = NOTE_TOOL_BY_ENTITY[matched.entityType];
    const idArg = ID_ARG_BY_ENTITY[matched.entityType];
    if (noteTool && idArg) {
      actions.push(makeAction({
        tool: noteTool,
        args: {
          [idArg]: matched.entityId,
          content: buildCallNote(analysis, {
            callDate,
            durationSeconds,
            language: analysis.language,
            recordingId,
          }),
        },
        title: `Add call summary note to ${matched.entityType}`,
        description: matched.name ? `Record: ${matched.name}` : '',
        requiresApproval: !autoApplyNotes,
        reason: 'Every analysed call is logged on the customer record.',
      }));
    }
  }

  // 2. No CRM record for this number — offer to create a lead.
  if (!matched && (analysis.isNewLead || analysis.customer?.name || phone)) {
    const leadType = LEAD_TYPE_BY_ROLE[analysis.counterpartyRole] || 'buyer';
    const requirement = analysis.requirements || {};
    const requirementPayload = {};
    if (requirement.budgetMax ?? requirement.budgetMin) {
      requirementPayload.budget = requirement.budgetMax ?? requirement.budgetMin;
    }
    if (requirement.locations?.length) requirementPayload.preferredArea = requirement.locations[0];
    if (requirement.bhk) requirementPayload.bhk = requirement.bhk;
    if (requirement.propertyType) requirementPayload.propertyType = requirement.propertyType;
    if (requirement.furnishing) requirementPayload.furnishing = requirement.furnishing;
    const requirementText = analysis.summary?.slice(0, 500);
    if (requirementText) requirementPayload.requirement = requirementText;

    const args = {
      name: analysis.customer?.name || `Caller ${phone || ''}`.trim(),
      leadType,
      ...(phone ? { phone } : {}),
    };
    if (Object.keys(requirementPayload).length > 0) {
      const key = leadType === 'tenant' ? 'tenantRequirement' : 'buyerRequirement';
      if (leadType === 'buyer' || leadType === 'tenant') args[key] = requirementPayload;
    }

    actions.push(makeAction({
      tool: 'create_lead',
      args,
      title: 'Create new lead',
      description: `No CRM record matched ${phone || 'this caller'}.`,
      requiresApproval: true,
      reason: 'Caller is not in the CRM yet.',
    }));
  }

  // 3. Refresh lead requirements / status from what was discussed.
  if (matched && matched.entityType === ENTITY_TYPE.LEAD) {
    const requirement = analysis.requirements || {};
    const updateArgs = { leadId: matched.entityId };
    const requirementPayload = {};

    if (requirement.budgetMax ?? requirement.budgetMin) {
      requirementPayload.budget = requirement.budgetMax ?? requirement.budgetMin;
    }
    if (requirement.locations?.length) requirementPayload.preferredArea = requirement.locations[0];
    if (requirement.bhk) requirementPayload.bhk = requirement.bhk;
    if (requirement.propertyType) requirementPayload.propertyType = requirement.propertyType;
    if (requirement.furnishing) requirementPayload.furnishing = requirement.furnishing;

    if (Object.keys(requirementPayload).length > 0) {
      updateArgs.buyerRequirement = requirementPayload;
    }
    if (analysis.suggestedLeadStatus) {
      updateArgs.status = analysis.suggestedLeadStatus;
    }

    if (Object.keys(updateArgs).length > 1) {
      const changed = [];
      if (updateArgs.status) changed.push(`status → ${updateArgs.status}`);
      if (updateArgs.buyerRequirement) changed.push('requirement details');
      actions.push(makeAction({
        tool: 'update_lead',
        args: updateArgs,
        title: 'Update lead from call',
        description: changed.join(', '),
        requiresApproval: true,
        reason: 'Requirements or status changed during the call.',
      }));
    }
  }

  // 4. Site visit requested.
  if (matched && analysis.siteVisit?.requested) {
    const date = analysis.siteVisit.preferredDate || nextDay(callDate, 2);
    const time = analysis.siteVisit.preferredTime || DEFAULT_MEETING_TIME;
    actions.push(makeAction({
      tool: 'create_meeting',
      args: {
        title: `Site visit — ${matched.name || 'customer'}`,
        scheduledDate: `${date}T${time}`,
        relatedEntityType: matched.entityType,
        relatedEntityId: matched.entityId,
        notes: [
          'Site visit requested during a recorded call.',
          analysis.siteVisit.propertyOrProject ? `Property/project: ${analysis.siteVisit.propertyOrProject}` : '',
          `Source: call recording ${recordingId}`,
        ].filter(Boolean).join('\n'),
        ...(analysis.siteVisit.propertyOrProject ? { location: analysis.siteVisit.propertyOrProject } : {}),
      },
      title: 'Schedule site visit',
      description: `${date} at ${time}${analysis.siteVisit.preferredDate ? '' : ' (date not stated on the call — please confirm)'}`,
      requiresApproval: true,
      reason: 'Customer asked for a site visit.',
    }));
  }

  // 5. Property work (painting / whitewashing / repairs) needs owner sign-off
  //    before it goes on the calendar.
  const hasMaintenanceTopic = (analysis.topics || []).some((topic) => MAINTENANCE_TOPICS.includes(topic));
  if (matched && (analysis.maintenance?.required || hasMaintenanceTopic)) {
    const date = analysis.maintenance?.preferredDate || nextDay(callDate, 3);
    const workType = analysis.maintenance?.workType || 'maintenance';
    const costLine = analysis.maintenance?.estimatedCost
      ? `Estimated cost discussed: ₹${formatMoney(analysis.maintenance.estimatedCost)}`
      : '';

    actions.push(makeAction({
      tool: 'create_meeting',
      args: {
        title: `Maintenance (${workType}) — ${matched.name || 'customer'}`,
        scheduledDate: `${date}T${DEFAULT_MEETING_TIME}`,
        relatedEntityType: matched.entityType,
        relatedEntityId: matched.entityId,
        notes: [
          `Property work discussed on a recorded call: ${workType}.`,
          analysis.maintenance?.description || '',
          costLine,
          'Requires agency owner approval before scheduling.',
          `Source: call recording ${recordingId}`,
        ].filter(Boolean).join('\n'),
      },
      title: `Approve ${workType} work visit`,
      description: [
        analysis.maintenance?.description || 'Property work was discussed on this call.',
        costLine,
      ].filter(Boolean).join(' · '),
      requiresApproval: true,
      reason: 'Painting/whitewashing/repair work needs owner approval.',
    }));
  }

  // 6. Explicit follow-up commitment.
  if (matched && analysis.followUp?.required) {
    const date = analysis.followUp.date || nextDay(callDate, 1);
    const time = analysis.followUp.time || DEFAULT_MEETING_TIME;
    actions.push(makeAction({
      tool: 'create_meeting',
      args: {
        title: `Follow-up call — ${matched.name || 'customer'}`,
        scheduledDate: `${date}T${time}`,
        relatedEntityType: matched.entityType,
        relatedEntityId: matched.entityId,
        notes: [
          analysis.followUp.reason || 'Follow-up promised during a recorded call.',
          `Source: call recording ${recordingId}`,
        ].filter(Boolean).join('\n'),
      },
      title: 'Schedule follow-up',
      description: `${date} at ${time}`,
      requiresApproval: true,
      reason: 'A follow-up was promised on the call.',
    }));
  }

  // Safety net: never emit a tool outside the proposable allowlist, and force
  // approval for anything that is not auto-applicable.
  return actions
    .filter((action) => PROPOSABLE_TOOLS.includes(action.tool))
    .map((action) => ({
      ...action,
      requiresApproval: AUTO_APPLICABLE_TOOLS.includes(action.tool) ? action.requiresApproval : true,
    }));
}

/**
 * Identity of an action for de-duplication across re-analysis runs.
 *
 * Two actions are "the same action" when they call the same tool against the
 * same CRM record. The target is taken from whichever entity-id argument the
 * tool uses, so re-linking a recording to a *different* record yields a
 * different identity and the note is legitimately written to the new record.
 */
function actionIdentity(action) {
  // Stored actions carry their tool arguments under `arguments` (see makeAction).
  const args = action?.arguments || {};
  const idArg = Object.values(ID_ARG_BY_ENTITY).find((key) => args[key] != null);
  return `${action?.tool || ''}|${idArg ? `${idArg}:${args[idArg]}` : ''}`;
}

/**
 * Fold a freshly planned action list onto the actions a recording already has.
 *
 * Re-analysis (`/reanalyze`, or `/link` with `reanalyze: true`) used to replace
 * `proposedActions` wholesale, which had two consequences:
 *
 *  1. Already-applied actions vanished from the record, so the UI lost the
 *     history of what the pipeline had actually written to the CRM. The
 *     `/reanalyze` route tried to prevent this by pre-writing the applied
 *     subset, but the analysis stage overwrote it moments later — the guard
 *     never worked.
 *  2. The auto-applied call-summary note was planned again with a fresh
 *     `actionId` in PENDING state, so `applyAutomaticActions` wrote a second
 *     identical note onto the customer record on every re-analysis.
 *
 * Applied actions are therefore kept as-is and suppress a re-plan of the same
 * tool against the same record. A re-analysis that produces a *better* summary
 * deliberately does not rewrite an already-applied note: a broker seeing one
 * note per call is worth more than the marginally improved wording, and the
 * full analysis payload in S3 is always current.
 *
 * @param {object[]} freshActions newly planned actions
 * @param {object[]} existingActions actions currently on the recording
 * @returns {object[]} applied actions first, then the non-duplicate fresh ones
 */
export function mergeWithAppliedActions(freshActions = [], existingActions = []) {
  const applied = (existingActions || []).filter((a) => a?.status === ACTION_STATUS.APPLIED);
  if (applied.length === 0) return freshActions || [];

  const appliedIdentities = new Set(applied.map(actionIdentity));
  const kept = (freshActions || []).filter((action) => !appliedIdentities.has(actionIdentity(action)));
  return [...applied, ...kept];
}

/** Payment/khata topics are surfaced to the owner as a hint, never auto-posted. */
export function buildFinancialHints(analysis) {
  if (!analysis?.payment?.discussed) return [];
  const hints = [];
  const amount = analysis.payment.amount ? `₹${formatMoney(analysis.payment.amount)}` : 'an unspecified amount';
  hints.push(
    `Payment discussed (${analysis.payment.direction || 'unspecified'}): ${amount}`
    + `${analysis.payment.dueDate ? `, due ${analysis.payment.dueDate}` : ''}.`
    + ' Record it in Khata Book manually if it is confirmed.',
  );
  return hints;
}
