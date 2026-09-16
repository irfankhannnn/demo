import serverlessExpress from '@codegenie/serverless-express';
import { createApp } from './app';
import { loadConfig } from './config/config';

// Load config at cold start
loadConfig();

const app = createApp();
const serverlessExpressInstance = serverlessExpress({ app });

// API Gateway's custom-domain base path mapping only affects routing
// selection - it does not strip the base path from the event.path/rawPath a
// Lambda proxy integration receives, so we strip it ourselves. Same shape as
// services/reality-flow-authentication/src/index.ts's stripBasePath. Only strips when
// the path is exactly /<basePath> or starts with /<basePath>/, so raw invoke
// URLs keep working during rollout.
function stripBasePath(pathValue: unknown): unknown {
  if (typeof pathValue !== 'string') {
    return pathValue;
  }
  const basePath = (process.env.MCP_API_BASE_PATH || '').replace(/^\/+|\/+$/g, '');
  if (!basePath) {
    return pathValue;
  }
  const normalized = `/${basePath}`;
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

  console.log('MCP Lambda invoked:', JSON.stringify({
    path: event.path,
    httpMethod: event.httpMethod,
    headers: event.headers,
    requestContextAuthorizer: event?.requestContext?.authorizer,
  }));

  // API Gateway JWT authorizer returns context (tenantId, userId, clientId, scopes)
  // but does NOT automatically inject these as headers. serverless-express maps
  // event.headers (or event.multiValueHeaders for API Gateway v1) to Express
  // request headers, so we inject the authorizer context into BOTH to ensure
  // the MCP handler can read them via req.headers['x-tenant-id'].
  const authorizer = event?.requestContext?.authorizer;
  if (authorizer) {
    const contextHeaders: Record<string, string> = {};
    if (authorizer.tenantId) contextHeaders['x-tenant-id'] = authorizer.tenantId;
    if (authorizer.userId) contextHeaders['x-user-id'] = authorizer.userId;
    if (authorizer.clientId) contextHeaders['x-client-id'] = authorizer.clientId;
    if (authorizer.scopes) contextHeaders['x-scopes'] = authorizer.scopes;

    // Inject into event.headers (used by API Gateway v2 and fallback for v1)
    event.headers = event.headers || {};
    for (const [key, value] of Object.entries(contextHeaders)) {
      if (!event.headers[key]) event.headers[key] = value;
    }

    // Inject into event.multiValueHeaders (used by API Gateway v1)
    // serverless-express prioritizes multiValueHeaders over headers when present.
    if (event.multiValueHeaders) {
      for (const [key, value] of Object.entries(contextHeaders)) {
        if (!event.multiValueHeaders[key]) event.multiValueHeaders[key] = [value];
      }
    }

    console.log('Injected authorizer context into headers:', JSON.stringify(event.headers));
  } else {
    console.log('No authorizer context found in event');
  }

  return serverlessExpressInstance(event, context);
};
