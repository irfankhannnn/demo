// Lambda entry point.
//
// assertEnv runs at module load, during the cold start, so a stack deployed
// without its CRM key, caller keys or user pool fails its first invocation
// with a readable message rather than answering 500s to real buyers.

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
  // JSON, XML, text and one HTML page — nothing binary. API Gateway must not
  // base64-wrap any of it.
  binary: false,
});

/**
 * API Gateway's base-path mapping affects routing selection only — for a proxy
 * integration the base path is still present in event.path, so we strip it
 * ourselves. Mirrors public-app/property-pages/lambda.js.
 */
function stripBasePath(pathValue) {
  if (typeof pathValue !== 'string') return pathValue;
  const basePath = process.env.MARKETPLACE_API_BASE_PATH;
  if (!basePath) return pathValue;

  const normalized = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  if (pathValue === normalized) return '/';
  if (pathValue.startsWith(`${normalized}/`)) return pathValue.slice(normalized.length) || '/';
  return pathValue;
}

export const handler = (event, context, callback) => {
  if (process.env.ENABLE_BASE_PATH_STRIP === 'true' && event) {
    if (typeof event.path === 'string') event.path = stripBasePath(event.path);
    if (typeof event.rawPath === 'string') event.rawPath = stripBasePath(event.rawPath);
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
