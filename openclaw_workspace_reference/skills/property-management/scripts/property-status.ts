import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'property-status';
const SKILL_NAME = 'property-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: property-status.ts \'<json with action and propertyId>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { action, propertyId, _meta, ...rest } = payload;

  if (!action || !propertyId) { console.error('Error: action and propertyId are required.'); process.exit(1); }

  let res: any;

  if (action === 'list-for-sale') {
    if (!rest.listedPrice) { console.error('Error: listedPrice is required.'); process.exit(1); }
    lastRequestLog = { method: 'POST', url: `/api/crm/properties/${propertyId}/list-for-sale`, body: { listedPrice: rest.listedPrice } };
    res = await crmClient.post(`/api/crm/properties/${propertyId}/list-for-sale`, { listedPrice: rest.listedPrice });
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    console.log(`Property [${propertyId}] listed for sale at ₹${rest.listedPrice}. Status: ${res.data.status}`);

  } else if (action === 'list-for-rent') {
    if (!rest.expectedRent) { console.error('Error: expectedRent is required.'); process.exit(1); }
    const rentBody = { expectedRent: rest.expectedRent, securityDeposit: rest.securityDeposit || 0 };
    lastRequestLog = { method: 'POST', url: `/api/crm/properties/${propertyId}/list-for-rent`, body: rentBody };
    res = await crmClient.post(`/api/crm/properties/${propertyId}/list-for-rent`, rentBody);
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    console.log(`Property [${propertyId}] listed for rent at ₹${rest.expectedRent}/mo. Status: ${res.data.status}`);

  } else if (action === 'mark-sold') {
    if (!rest.soldPrice) { console.error('Error: soldPrice is required.'); process.exit(1); }
    const saleType = rest.saleType || 'direct';
    if (saleType === 'direct' && !rest.buyerId) { console.error('Error: buyerId required for direct sale.'); process.exit(1); }
    const soldBody = { soldPrice: rest.soldPrice, buyerId: rest.buyerId || null, saleType, reasonLost: rest.reasonLost || null, notes: rest.notes || null, brokerageAmount: rest.brokerageAmount || null, brokerageLost: rest.brokerageLost || null };
    lastRequestLog = { method: 'POST', url: `/api/crm/properties/${propertyId}/mark-sold`, body: soldBody };
    res = await crmClient.post(`/api/crm/properties/${propertyId}/mark-sold`, soldBody);
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    console.log(`Property [${propertyId}] marked as SOLD at ₹${rest.soldPrice}. Status: ${res.data.status}`);

  } else if (action === 'mark-rented') {
    if (!rest.customerId || !rest.rentalDetails) { console.error('Error: customerId and rentalDetails are required.'); process.exit(1); }
    const rentedBody = { customerId: rest.customerId, rentalDetails: rest.rentalDetails };
    lastRequestLog = { method: 'POST', url: `/api/crm/properties/${propertyId}/mark-rented`, body: rentedBody };
    res = await crmClient.post(`/api/crm/properties/${propertyId}/mark-rented`, rentedBody);
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    console.log(`Property [${propertyId}] marked as RENTED to tenant [${rest.customerId}]. Status: ${res.data.status}`);

  } else if (action === 'vacate') {
    lastRequestLog = { method: 'POST', url: `/api/crm/properties/${propertyId}/vacate`, body: {} };
    res = await crmClient.post(`/api/crm/properties/${propertyId}/vacate`, {});
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    const p = res.data.property || res.data;
    console.log(`Property [${propertyId}] vacated. Status: ${p.status}`);

  } else {
    console.error('Unknown action. Use: list-for-sale | list-for-rent | mark-sold | mark-rented | vacate');
    process.exit(1);
  }

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { propertyId, action } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Property not found.'); else console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});