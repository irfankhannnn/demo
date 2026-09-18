import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { loadConfig } from './config/config';
import { logger } from './utils/logger';

const config = loadConfig();
const app = createApp({ injectTenantId: process.env.MCP_TENANT_ID });

const PORT = config.PORT;

const server = app.listen(PORT, () => {
  logger.info('local_server.started', {
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
  logger.info('local_server.shutdown', { signal: 'SIGTERM' });
  server.close(() => {
    logger.info('local_server.closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('local_server.shutdown', { signal: 'SIGINT' });
  server.close(() => {
    logger.info('local_server.closed');
    process.exit(0);
  });
});
