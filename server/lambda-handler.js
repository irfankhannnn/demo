import serverlessExpress from '@vendia/serverless-express';
import app from './server.js';
import { applyCorsHeaders, buildResponse } from './utils/response.js';
import { captureServerException, flushSentry } from './lib/sentry.js';
import { shutdownPostHog } from './lib/posthog.js';

let serverlessExpressInstance;

function stripConfiguredBasePath(pathValue) {
  if (!pathValue || typeof pathValue !== 'string') {
    return pathValue;
  }

  const configuredBasePaths = [
    process.env.CRM_API_BASE_PATH,
    process.env.PUBLIC_API_BASE_PATH,
  ]
    .filter(Boolean)
    .map((basePath) => `/${String(basePath).replace(/^\/+|\/+$/g, '')}`)
    .filter((basePath, index, arr) => arr.indexOf(basePath) === index)
    .sort((a, b) => b.length - a.length);

  for (const basePath of configuredBasePaths) {
    if (pathValue === basePath) {
      return '/';
    }

    if (pathValue.startsWith(`${basePath}/`)) {
      return pathValue.slice(basePath.length) || '/';
    }
  }

  return pathValue;
}

function normalizeEventPath(event) {
  if (!event || typeof event !== 'object') {
    return event;
  }

  if (typeof event.path === 'string') {
    event.path = stripConfiguredBasePath(event.path);
  }

  if (typeof event.rawPath === 'string') {
    event.rawPath = stripConfiguredBasePath(event.rawPath);
  }

  if (event.requestContext && typeof event.requestContext === 'object') {
    if (typeof event.requestContext.path === 'string') {
      event.requestContext.path = stripConfiguredBasePath(event.requestContext.path);
    }

    if (event.requestContext.http && typeof event.requestContext.http.path === 'string') {
      event.requestContext.http.path = stripConfiguredBasePath(event.requestContext.http.path);
    }
  }

  return event;
}

export const handler = async (event, context) => {
  // Handle OPTIONS preflight requests directly
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, '');
  }

  // Ensure we always have a correlation id available to Express + logs
  event.headers = event.headers || {};
  if (!event.headers['x-request-id'] && !event.headers['X-Request-Id']) {
    event.headers['x-request-id'] = context?.awsRequestId;
  }

  normalizeEventPath(event);

  // Initialize serverless-express instance
  if (!serverlessExpressInstance) {
    serverlessExpressInstance = serverlessExpress({ 
      app,
      binarySettings: {
        contentTypes: [
          'image/*',
          'font/*',
          'text/html',
          'application/json',
          'application/xml',
          'application/pdf',
          'application/octet-stream',
          'multipart/form-data',
          'video/*',
          'audio/*'
        ]
      }
    });
  }

  // Process the request through Express
  try {
    const response = await serverlessExpressInstance(event, context);
    return applyCorsHeaders(response);
  } catch (error) {
    // Capture unhandled Lambda-level exceptions in Sentry (env-guarded no-op
    // when SENTRY_DSN_SERVER is unset). Flush before the Lambda freezes.
    await captureServerException(error, {
      path: event?.path || event?.rawPath,
      method: event?.httpMethod || event?.requestContext?.http?.method,
      requestId: context?.awsRequestId,
    });
    await flushSentry();
    throw error;
  } finally {
    await shutdownPostHog();
  }
};
