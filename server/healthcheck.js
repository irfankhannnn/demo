import { logger } from './logger.js';
import { getAuthServiceBaseUrl } from './config/serviceUrls.js';

/**
 * Deep health check — validates all external dependencies.
 * Returns 200 if all healthy, 503 if any dependency is down.
 */
export async function deepHealthCheck(req, res) {
  const checks = {
    dynamodb: false,
    authService: false,
  };

  // Check DynamoDB
  try {
    const { DynamoDBClient, ListTablesCommand } = await import('@aws-sdk/client-dynamodb');
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
    await client.send(new ListTablesCommand({ Limit: 1 }));
    checks.dynamodb = true;
  } catch (err) {
    logger.error('healthcheck.dynamodb.failed', { error: err.message });
  }

  // Check Auth Service
  try {
    const authUrl = getAuthServiceBaseUrl();
    const response = await fetch(`${authUrl}/health`, { signal: AbortSignal.timeout(3000) });
    checks.authService = response.ok;
  } catch (err) {
    logger.error('healthcheck.auth.failed', { error: err.message });
  }

  const allOk = Object.values(checks).every(Boolean);

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
