import serverlessExpress from '@codegenie/serverless-express';
import { createApp } from './app';
import { loadConfig } from './config/config';

// Load config at cold start
loadConfig();

const app = createApp();
const serverlessExpressInstance = serverlessExpress({ app });

export const handler = (event: any, context: any) => {
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
