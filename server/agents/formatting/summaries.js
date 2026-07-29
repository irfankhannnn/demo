/**
 * Deterministic WhatsApp templates for *_summary tools (Interaction Design v1).
 */

const LEAD_TYPE_ORDER = ['buyer', 'seller', 'tenant', 'owner'];
const LEAD_TYPE_LABEL = {
  buyer: 'Buyer',
  seller: 'Seller',
  tenant: 'Tenant',
  owner: 'Owner',
};

/**
 * Full glance card for get_leads_summary (totals, by type, priority, unassigned).
 */
export function formatLeadsSummary(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const total = Number(payload.total) || 0;
  const active = payload.active != null ? Number(payload.active) : total;
  const byType = payload.byType && typeof payload.byType === 'object' ? payload.byType : {};
  const byPriority = payload.byPriority && typeof payload.byPriority === 'object' ? payload.byPriority : {};
  const unassigned = Number(payload.unassigned) || 0;

  const typeLines = LEAD_TYPE_ORDER.map((key) => {
    const n = Number(byType[key]) || 0;
    return `• ${LEAD_TYPE_LABEL[key]}: ${n}`;
  });

  return [
    '📊 Lead Summary',
    '',
    `Total Leads: ${total}`,
    `Active: ${active}`,
    '',
    'By Type',
    ...typeLines,
    '',
    'Priority',
    `🔴 High: ${Number(byPriority.high) || 0}`,
    `🟡 Medium: ${Number(byPriority.medium) || 0}`,
    `🟢 Low: ${Number(byPriority.low) || 0}`,
    '',
    `⚠️ Unassigned: ${unassigned}`,
  ].join('\n');
}
