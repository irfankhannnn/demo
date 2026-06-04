import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: tenant-rental.ts \'<json with action and customerId>\'');
    process.exit(1);
  }

  const { action, customerId, ...rest } = JSON.parse(raw);
  if (!customerId) { console.error('Error: customerId is required.'); process.exit(1); }

  if (action === 'history') {
    const res = await axios.get(`${BASE}/api/crm/customers/${customerId}/rental-history`, { headers });
    const { currentRental, rentalHistory } = res.data;
    if (currentRental) {
      console.log(`Current rental: Property [${currentRental.propertyId}] | ₹${currentRental.monthlyRent}/mo`);
      console.log(`  Lease: ${currentRental.leaseStartDate} → ${currentRental.leaseEndDate}`);
    } else {
      console.log('No current rental.');
    }
    if (rentalHistory?.length) {
      console.log(`Rental history (${rentalHistory.length}):`);
      rentalHistory.forEach((r: any) => console.log(`  - [${r.propertyId}] ₹${r.monthlyRent}/mo | ${r.leaseStartDate} → ${r.leaseEndDate}`));
    }

  } else if (action === 'update') {
    const rentalDetails: Record<string, any> = {};
    if (rest.propertyId) rentalDetails.propertyId = rest.propertyId;
    if (rest.leaseStartDate) rentalDetails.leaseStartDate = rest.leaseStartDate;
    if (rest.leaseEndDate) rentalDetails.leaseEndDate = rest.leaseEndDate;
    if (rest.monthlyRent) rentalDetails.monthlyRent = rest.monthlyRent;
    if (rest.securityDeposit !== undefined) rentalDetails.securityDeposit = rest.securityDeposit;

    await axios.put(`${BASE}/api/crm/customers/${customerId}/current-rental`, rentalDetails, { headers });
    console.log(`Rental updated for tenant [${customerId}].`);
    console.log(`Fields: ${Object.keys(rentalDetails).join(', ')}`);

  } else if (action === 'archive') {
    const res = await axios.post(`${BASE}/api/crm/customers/${customerId}/archive-rental`, {}, { headers });
    console.log(`Rental archived for tenant [${customerId}]. ${res.data.message || ''}`);

  } else {
    console.error('Unknown action. Use: history | update | archive');
    process.exit(1);
  }
}

main().catch(e => {
  const status = e.response?.status;
  if (status === 404) console.error('Tenant not found.');
  else console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
