import serverlessExpress from '@vendia/serverless-express';
import { createApp } from './app';
import { loadConfig } from './config/config';

// Fail fast at cold start on bad config rather than on the first request.
const config = loadConfig();
const app = createApp();
const serverlessExpressInstance = serverlessExpress({ app });

/**
 * API Gateway's custom-domain base path mapping only affects routing
 * selection — it does not strip the base path from the event.path a Lambda
 * proxy integration receives — so the Lambda strips it itself. Same
 * pattern as services/reality-flow-authentication/src/index.ts. Only runs
 * when ENABLE_BASE_PATH_STRIP=true (i.e. once the custom domain mapping
 * is actually enabled for this stack).
 */
function stripBasePath(pathValue: unknown): unknown {
  if (typeof pathValue !== 'string') return pathValue;
  const basePath = config.MARKETPLACE_AUTH_BASE_PATH;
  if (!basePath) return pathValue;
  const normalized = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  if (pathValue === normalized) return '/';
  if (pathValue.startsWith(`${normalized}/`)) return pathValue.slice(normalized.length) || '/';
  return pathValue;
}

function normalizeEventPath(event: any): void {
  if (!event || typeof event !== 'object') return;
  if (typeof event.path === 'string') event.path = stripBasePath(event.path);
  if (typeof event.rawPath === 'string') event.rawPath = stripBasePath(event.rawPath);
  if (event.requestContext?.path) event.requestContext.path = stripBasePath(event.requestContext.path);
  if (event.requestContext?.http?.path) event.requestContext.http.path = stripBasePath(event.requestContext.http.path);
}

export const handler = (event: any, context: any) => {
  if (config.ENABLE_BASE_PATH_STRIP) normalizeEventPath(event);

  // The rate limiters read the caller IP from here (requestContext.identity.sourceIp).
  (app as any).locals.apiGatewayEvent = event;

  return serverlessExpressInstance(event, context);
};
