/**
 * Standalone golden check (no Jest required).
 * Usage: node agents/run-golden-check.mjs
 * Writes agents/golden-check-result.txt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatToolResult, formatAgentReply } from './responseFormatter.js';
import { buildLeadDetails } from '../aiViewBuilders/leadAIViewBuilder.js';
import { buildOwnerDetails } from '../aiViewBuilders/ownerAIViewBuilder.js';
import { buildBuyerDetails } from '../aiViewBuilders/buyerAIViewBuilder.js';
import { buildPropertyDetails } from '../aiViewBuilders/propertyAIViewBuilder.js';
import { buildContactDetails } from '../aiViewBuilders/contactAIViewBuilder.js';
import { buildTenantDetails } from '../aiViewBuilders/tenantAIViewBuilder.js';
import { buildMeetingDetails } from '../aiViewBuilders/meetingAIViewBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lines = [];
let failed = 0;

function check(name, cond) {
  const msg = (cond ? 'OK  : ' : 'FAIL: ') + name;
  lines.push(msg);
  if (!cond) failed += 1;
}

const leadDto = buildLeadDetails({
  leadId: 'uuid',
  name: 'Sakina Shaikh',
  leadType: 'buyer',
  phone: '9876512345',
  status: 'qualified',
  priority: 'high',
  score: 91,
  assignedTo: 'Imran',
  createdAt: '2026-07-12',
  lastActivityAt: new Date(Date.now() - 86400000).toISOString(),
  nextFollowUpDate: new Date(Date.now() + 86400000).toISOString(),
  buyerRequirement: { budget: 9000000, preferredArea: 'Andheri', bhk: 2, propertyType: 'Apartment' },
  notes: [{ content: 'Site visit', createdAt: '2026-07-18' }],
  history: [1, 2, 3],
});
const leadText = formatToolResult('get_lead', { ok: true, data: leadDto });
check('lead card identity', leadText.includes('*Sakina Shaikh*') && leadText.includes('Buyer Lead'));
check('lead recommendation', leadText.includes('Recommendation') && !!leadDto.metadata.recommendation);
check('lead no uuid label', !leadText.includes('Lead ID'));

const ownerDto = buildOwnerDetails({
  ownerId: 'o1',
  name: 'Sakina Shaikh',
  phone: '9876512345',
  status: 'active',
  properties: [{ propertyType: 'Apartment', area: 'Andheri', status: 'available' }],
});
const ownerText = formatToolResult('get_owner', { ok: true, data: ownerDto });
check('owner recommendation', ownerText.includes('Recommendation') && !!ownerDto.metadata.recommendation);

const buyerDto = buildBuyerDetails({ buyerId: 'b1', name: 'Rahul', phone: '9000000000', budget: 8000000, preferredArea: 'Powai', status: 'active' });
check('buyer recommendation', !!buyerDto.metadata.recommendation);

const propDto = buildPropertyDetails({ propertyId: 'p1', title: 'Flat', status: 'for-sale', salePrice: 10000000, area: 'Bandra', ownerId: 'hide' });
const propText = formatToolResult('get_property', { ok: true, data: propDto });
check('property no id + recommendation', !propText.includes('Property ID') && propText.includes('Recommendation'));

check('contact recommendation', !!buildContactDetails({ contactId: 'c1', name: 'Ravi', role: 'broker', phone: '9111111111' }).metadata.recommendation);
check('tenant recommendation', !!buildTenantDetails({ customerId: 't1', name: 'Neha', budget: 30000, preferredArea: 'Kurla' }).metadata.recommendation);
check('meeting recommendation', !!buildMeetingDetails({ meetingId: 'm1', title: 'Visit', scheduledDate: new Date(Date.now() + 86400000).toISOString(), status: 'scheduled' }).metadata.recommendation);

const list = formatToolResult('search_properties', {
  ok: true,
  data: { metadata: { total: 1 }, data: [{ propertyId: 'p1', title: 'Sea View', status: 'for-rent', monthlyRent: 65000, area: 'Bandra' }] },
});
check('property list header', list.includes('*Properties (1)*'));

const empty = formatToolResult('search_contacts', { ok: true, data: { metadata: { total: 0 }, data: [] } });
check('empty contacts', empty.includes('No contacts found'));

const create = formatToolResult('create_lead', {
  ok: true,
  data: { leadId: 'x', name: 'Faizan', leadType: 'buyer', phone: '9876543210', status: 'new', buyerRequirement: { budget: 8000000, preferredArea: 'Andheri' } },
});
check('create compact', create.includes('created') && !create.includes('Quick Stats'));

const detailWins = formatAgentReply('short intro', [
  { tool: 'get_lead', result: { ok: true, data: { leadId: '1', name: 'A', leadType: 'buyer', status: 'new' } } },
]);
check('detail beats intro', detailWins.includes('*A*'));

const summary = formatAgentReply('LLM pipes • Buyer: 1 | Seller: 2', [
  {
    tool: 'get_leads_summary',
    result: {
      ok: true,
      data: {
        total: 16,
        active: 14,
        unassigned: 13,
        byType: { buyer: 8, seller: 2, tenant: 4, owner: 2 },
        byPriority: { high: 5, medium: 9, low: 2 },
      },
    },
  },
]);
check('leads summary formatter', summary.includes('📊 Lead Summary') && summary.includes('• Buyer: 8') && !summary.includes('|'));

// ─── Lead Card List pattern ──────────────────────────────────────────────────
const leadCardList = formatAgentReply('intro text', [
  {
    tool: 'search_leads',
    input: { priority: 'high' },
    result: {
      ok: true,
      data: {
        metadata: { view: 'searchResults', entityType: 'lead', total: 2, shown: 2, hasMore: false },
        data: [
          { leadId: 'l1', name: 'Danish Shaikh', leadType: 'buyer', status: 'new', area: 'Andheri', bhk: 2, propertyType: 'apartment', budget: 15000000 },
          { leadId: 'l2', name: 'Anita Acharya', leadType: 'seller', status: 'contacted', propertyType: 'house', budget: 16200000 },
        ],
      },
    },
  },
]);
check('lead list dynamic title', leadCardList.includes('🔴') && leadCardList.includes('*High Priority Leads (2)*'));
check('lead card layout', leadCardList.includes('1. *Danish Shaikh*')
  && leadCardList.includes('🛒 Buyer • New')
  && leadCardList.includes('📍 Andheri')
  && leadCardList.includes('🏠 2 BHK Apartment')
  && leadCardList.includes('💰 ₹1.5Cr'));

const compositeTitle = formatAgentReply('', [
  {
    tool: 'search_leads',
    input: { priority: 'high', leadType: 'buyer', area: 'Pune' },
    result: {
      ok: true,
      data: {
        metadata: { view: 'searchResults', entityType: 'lead', total: 1 },
        data: [{ leadId: 'l3', name: 'Ravi', leadType: 'buyer', status: 'new', area: 'Pune', budget: 5000000 }],
      },
    },
  },
]);
check('lead composite title', compositeTitle.includes('*High Priority Buyer Leads in Pune (1)*'));

const areaQueryTitle = formatAgentReply('', [
  {
    tool: 'search_leads',
    input: { query: 'Kurla' },
    result: {
      ok: true,
      data: {
        metadata: { view: 'searchResults', entityType: 'lead', total: 1 },
        data: [{ leadId: 'l4', name: 'Sara', leadType: 'buyer', status: 'new', area: 'Kurla', budget: 4000000 }],
      },
    },
  },
]);
check('lead area-query title', areaQueryTitle.includes('📍 *Leads in Kurla (1)*'));

const contactList = formatAgentReply('', [
  {
    tool: 'search_leads',
    input: { priority: 'high', listTemplate: 'contact' },
    result: {
      ok: true,
      data: {
        metadata: { total: 1 },
        data: [{
          leadId: 'l5',
          name: 'Danish Shaikh',
          phone: '9876512345',
          leadType: 'buyer',
          status: 'new',
        }],
      },
    },
  },
]);
check('contact list template', contactList.includes('📞') && contactList.includes('🛒 Buyer') && !contactList.includes('💰'));

const customFields = formatAgentReply('', [
  {
    tool: 'search_leads',
    input: { responseFields: 'phone,leadType,status' },
    result: {
      ok: true,
      data: {
        metadata: { total: 1 },
        data: [{
          leadId: 'l6',
          name: 'Test Lead',
          phone: '9000000001',
          leadType: 'seller',
          status: 'contacted',
        }],
      },
    },
  },
]);
check('custom responseFields', customFields.includes('📞') && customFields.includes('Seller'));

lines.push('');
lines.push(failed ? `${failed} check(s) failed` : 'All golden checks passed');
const outPath = path.join(__dirname, 'golden-check-result.txt');
fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
process.exit(failed ? 1 : 0);
