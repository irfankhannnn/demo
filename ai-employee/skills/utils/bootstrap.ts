import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';

const envPaths = [
  path.join(os.homedir(), '.openclaw', 'workspace', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(process.cwd(), '.env'),
];

let loaded = false;

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loaded = true;
    break;
  }
}

if (!loaded) {
  dotenv.config();
}

const missing: string[] = [];
if (!process.env.CRM_API_BASE) missing.push('CRM_API_BASE');
if (!process.env.CRM_TOKEN) missing.push('CRM_TOKEN');

if (missing.length) {
  const searched = envPaths.join('\n  ');
  console.error(
    `ERROR: Missing required environment variables: ${missing.join(', ')}\n` +
    `Searched:\n  ${searched}\n` +
    `Create a .env file at one of these locations with:\n` +
    `  CRM_API_BASE=<your-api-url>\n` +
    `  CRM_TOKEN=<your-jwt-token>`
  );
  process.exit(1);
}