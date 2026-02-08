import dotenv from 'dotenv';
dotenv.config();

import { setAgencyAdminCredentials } from './agencyConfigService.js';

async function main() {
  const tenantId = 'happy_propertiesA3F9C0B2'; // your agency/tenant ID
  const username = 'admin'; // desired admin username
  const password = 'admin123';         // initial password

  await setAgencyAdminCredentials(tenantId, username, password);
  console.log('Agency admin seeded for tenant:', tenantId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});