// Lambda entry point.
//
// assertEnv runs at module load, i.e. during the cold start, so a stack
// deployed with a missing table name fails its very first invocation with a
// readable message instead of a DynamoDB ValidationException on some later
// write.

import serverless from 'serverless-http';
import { createApp } from './server.js';
import { assertEnv } from './config/env.js';
import { logger } from './logger.js';

assertEnv();

const app = createApp();

logger.info('lambda.cold_start', {
  functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
  region: process.env.AWS_REGION,
});

const serverlessHandler = serverless(app, {
  // API Gateway hands the body through as a string; serverless-http rebuilds
  // the request stream from it, and express.json's verify hook then sees the
  // same bytes the agent signed.
  request: (request, event) => {
    request.requestContextRequestId = event?.requestContext?.requestId;
  },
});

// API Gateway's custom-domain base path mapping only affects routing
// selection - it does not strip the base path from the event.path a Lambda
// proxy integration receives, so we strip it ourselves before handing the
// event to serverless-http. Mirrors server/lambda-handler.js's identical
// stripConfiguredBasePath. Only runs when ENABLE_BASE_PATH_STRIP=true (i.e.
// once the custom domain mapping is actually enabled for this stack).
function stripBasePath(pathValue) {
  if (typeof pathValue !== 'string') {
    return pathValue;
  }
  const basePath = process.env.INSTA_API_BASE_PATH;
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

export const handler = (event, context, callback) => {
  if (process.env.ENABLE_BASE_PATH_STRIP === 'true' && event) {
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
  return serverlessHandler(event, context, callback);
};

export default handler;
