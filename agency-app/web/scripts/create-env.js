// Script to help create .env file with proper configuration
import { createInterface } from 'readline';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🚀 Real Estate CRM - Environment Setup\n');
  console.log('This CRM app uses the SHARED backend from ../api\n');
  
  const defaultApiDomain = 'http://localhost:4000';
  const defaultApiBasePath = '';
  const defaultTenantId = 'happy_propertiesA3F9C0B2';
  const defaultPort = '8085';

  const apiDomainInput = await question(
    `Enter the CRM API custom domain host, or a full http://localhost origin for local dev (default: ${defaultApiDomain}): `
  );
  const apiBasePathInput = await question(
    `Enter the CRM API base path mapping, e.g. devrealestatecrm (blank for local dev): `
  );
  const tenantIdInput = await question(`Enter your Tenant ID (default: ${defaultTenantId}): `);
  const portInput = await question(`Enter CRM dev server port (default: ${defaultPort}): `);

  const apiDomain = apiDomainInput.trim() || defaultApiDomain;
  const apiBasePath = apiBasePathInput.trim() || defaultApiBasePath;
  const apiUrl = `${apiDomain}${apiBasePath ? `/${apiBasePath}` : ''} (+ /api)`;
  const finalTenantId = tenantIdInput.trim() || defaultTenantId;
  const finalPort = portInput.trim() || defaultPort;
  
  const envContent = `# CRM Frontend Environment
# Points to the SHARED backend in ../api

# CRM API: custom domain + base path (the app appends /api itself)
VITE_CRM_API_DOMAIN_NAME=${apiDomain}
VITE_CRM_API_BASE_PATH=${apiBasePath}
# Auth API: custom domain + base path
VITE_AUTH_API_DOMAIN_NAME=http://localhost:3002
VITE_AUTH_API_BASE_PATH=

# Tenant ID - Each organization has a unique ID for data isolation
VITE_TENANT_ID=${finalTenantId}

# Dev server port
VITE_PORT=${finalPort}
`;

  const envPath = join(__dirname, '..', '.env');
  writeFileSync(envPath, envContent);
  
  console.log('\n✅ .env file created successfully!');
  console.log('\nConfiguration:');
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  Tenant ID: ${finalTenantId}`);
  console.log('\n📝 You can edit .env file anytime to update these values.');
  console.log('\n🔑 Default login credentials:');
  console.log('  Username: admin');
  console.log('  Password: admin123');
  console.log('\n⚠️  Change password after first login via Settings page.');
  console.log('\n📌 Make sure the shared backend is running:');
  console.log('  cd ../api && npm run dev\n');
  
  rl.close();
}

main().catch(console.error);
