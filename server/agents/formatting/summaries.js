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
 * Full glance card for get_leads_summary (totals, by type, temperature, unassigned).
 */
export function formatLeadsSummary(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const total = Number(payload.total) || 0;
  const active = payload.active != null ? Number(payload.active) : total;
  const byType = payload.byType && typeof payload.byType === 'object' ? payload.byType : {};
  const byTemperature = payload.byTemperature && typeof payload.byTemperature === 'object' ? payload.byTemperature : {};
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
    'Temperature',
    `🔥 Hot: ${Number(byTemperature.hot) || 0}`,
    `🌤️ Warm: ${Number(byTemperature.warm) || 0}`,
    `❄️ Cold: ${Number(byTemperature.cold) || 0}`,
    `⚪ Unscored: ${Number(byTemperature.unscored) || 0}`,
    '',
    `⚠️ Unassigned: ${unassigned}`,
  ].join('\n');
}
