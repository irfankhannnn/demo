import serverlessExpress from '@vendia/serverless-express';
import { createApp } from './app';
import { loadConfig } from './config/config';

// Load config at cold start
loadConfig();

const app = createApp();
const serverlessExpressInstance = serverlessExpress({ app });

// API Gateway's custom-domain base path mapping only affects routing
// selection - it does not strip the base path from the event.path/rawPath a
// Lambda proxy integration receives, so we strip it ourselves. Mirrors
// apps/crm/server/lambda-handler.js's identical stripConfiguredBasePath. Only runs
// when ENABLE_BASE_PATH_STRIP=true (i.e. once the custom domain mapping is
// actually enabled for this stack).
function stripBasePath(pathValue: unknown): unknown {
  if (typeof pathValue !== 'string') {
    return pathValue;
  }
  const basePath = process.env.AUTH_API_BASE_PATH;
  if (!basePath) {
    return pathValue;
  }
  const normalized = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  if (pathValue === normalized) {
    return '/';
  }
  if (pathValue.startsWith(`${normalized}/`)) {
    return pathValue.slice(normalized.length) || '/';
  }
  return pathValue;
}

function normalizeEventPath(event: any): void {
  if (!event || typeof event !== 'object') {
    return;
  }
  if (typeof event.path === 'string') {
    event.path = stripBasePath(event.path);
  }
  if (typeof event.rawPath === 'string') {
    event.rawPath = stripBasePath(event.rawPath);
  }
  if (event.requestContext?.path) {
    event.requestContext.path = stripBasePath(event.requestContext.path);
  }
  if (event.requestContext?.http?.path) {
    event.requestContext.http.path = stripBasePath(event.requestContext.http.path);
  }
}

export const handler = (event: any, context: any) => {
  if (process.env.ENABLE_BASE_PATH_STRIP === 'true') {
    normalizeEventPath(event);
  }

  console.log('Lambda invoked:', JSON.stringify({ path: event.path, httpMethod: event.httpMethod }));

  // Store the full API Gateway event so controllers can access requestContext.authorizer.claims
  (app as any).locals.apiGatewayEvent = event;

  return serverlessExpressInstance(event, context);
};
