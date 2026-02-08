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
  console.log('This CRM app uses the SHARED backend from ../server\n');
  
  const defaultApiUrl = 'https://api.example.com/prod';
  const defaultTenantId = 'happy_propertiesA3F9C0B2';
  const defaultPort = '8085';
  
  const apiUrlInput = await question(
    `Enter your backend API base URL (API Gateway custom domain + base path mapping) (default: ${defaultApiUrl}): `
  );
  const tenantIdInput = await question(`Enter your Tenant ID (default: ${defaultTenantId}): `);
  const portInput = await question(`Enter CRM dev server port (default: ${defaultPort}): `);
  
  const apiUrl = apiUrlInput.trim() || defaultApiUrl;
  const finalTenantId = tenantIdInput.trim() || defaultTenantId;
  const finalPort = portInput.trim() || defaultPort;
  
  const envContent = `# CRM Frontend Environment
# Points to the SHARED backend in ../server

# Backend API URL
VITE_API_URL=${apiUrl}

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
  console.log('  cd ../server && npm run dev\n');
  
  rl.close();
}

main().catch(console.error);
