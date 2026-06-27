/**
 * MCP Local Dev Server
 * 
 * Runs the MCP server locally for development and testing.
 * 
 * Usage:
 *   node server/mcp-server/localServer.js
 * 
 * Environment variables:
 *   PORT (default: 4001)
 *   MCP_TENANT_ID (for local testing, simulates API Gateway header)
 *   JWT_SECRET (for token validation)
 *   CRM_DYNAMODB_TABLE_NAME (for DynamoDB access)
 * 
 * Testing:
 *   curl -X POST http://localhost:4001/mcp \
 *     -H "Content-Type: application/json" \
 *     -H "x-tenant-id: test-agency" \
 *     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
 */

import 'dotenv/config';
import app from './httpServer.js';
import { logger } from '../logger.js';

const PORT = process.env.PORT || 4001;

// Middleware: Add tenantId from env var for local testing
app.use((req, res, next) => {
  if (!req.headers['x-tenant-id'] && process.env.MCP_TENANT_ID) {
    req.headers['x-tenant-id'] = process.env.MCP_TENANT_ID;
  }
  next();
});

// Start server
const server = app.listen(PORT, () => {
  logger.info('mcp.local_server.started', {
    port: PORT,
    url: `http://localhost:${PORT}/mcp`,
    healthCheck: `http://localhost:${PORT}/health`,
    tenantId: process.env.MCP_TENANT_ID || '(from x-tenant-id header)',
  });
  console.error(`\n✅ MCP server running on http://localhost:${PORT}/mcp`);
  console.error(`   Health check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('mcp.local_server.shutdown', { signal: 'SIGTERM' });
  server.close(() => {
    logger.info('mcp.local_server.closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('mcp.local_server.shutdown', { signal: 'SIGINT' });
  server.close(() => {
    logger.info('mcp.local_server.closed');
    process.exit(0);
  });
});

export default server;
