#!/usr/bin/env node
/**
 * Generate a JWT token for the MCP server.
 * Usage: node generate-mcp-token.js <tenantId> [expiresIn]
 */
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const tenantId = process.argv[2];
const expiresIn = process.argv[3] || '30d';

if (!tenantId) {
  console.error('Usage: node generate-mcp-token.js <tenantId> [expiresIn]');
  process.exit(1);
}

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('Error: JWT_SECRET not set in environment');
  process.exit(1);
}

const payload = {
  tenantId,
  role: 'mcp-agent',
  iss: 'crm-mcp-service',
  iat: Math.floor(Date.now() / 1000),
};

const token = jwt.sign(payload, secret, { expiresIn });
console.log('\nMCP JWT Token:');
console.log(token);
console.log('\nUsage: export CRM_TOKEN=' + token);
console.log('       export MCP_TENANT_ID=' + tenantId);
