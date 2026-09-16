// AWS Lambda handler for the management API (API Gateway proxy integration).

import serverless from 'serverless-http';
import { hydrateConfigFromSecrets } from './config/secretsBootstrap.js';

// server.js reads process.env at module load in places, so it is imported only
// after Secrets Manager hydration has populated process.env. Memoised per
// container.
let handlerPromise = null;

function loadHandler() {
  if (!handlerPromise) {
    handlerPromise = hydrateConfigFromSecrets()
      .then(() => import('./server.js'))
      .then((serverModule) => serverless(serverModule.default));
  }
  return handlerPromise;
}

/**
 * Strip the custom-domain base path API Gateway forwards in the event path
 * (e.g. /devrealestatefollowup/api/followup/jobs → /api/followup/jobs).
 * Mirrors services/ai-calling-service/src/lambda-handler.js.
 */
export function stripBasePath(pathValue, prefixValue = process.env.API_BASE_PATH_PREFIX) {
  if (!pathValue || typeof pathValue !== 'string') return pathValue;
  const prefix = (prefixValue || '').replace(/^\/+|\/+$/g, '');
  if (!prefix) return pathValue;
  const basePath = `/${prefix}`;
  if (pathValue === basePath) return '/';
  if (pathValue.startsWith(`${basePath}/`)) return pathValue.slice(basePath.length) || '/';
  return pathValue;
}

export function normalizeEventPath(event) {
  if (!event || typeof event !== 'object') return event;
  if (typeof event.path === 'string') event.path = stripBasePath(event.path);
  if (typeof event.rawPath === 'string') event.rawPath = stripBasePath(event.rawPath);
  if (event.requestContext && typeof event.requestContext === 'object') {
    if (typeof event.requestContext.path === 'string') {
      event.requestContext.path = stripBasePath(event.requestContext.path);
    }
    if (event.requestContext.http && typeof event.requestContext.http.path === 'string') {
      event.requestContext.http.path = stripBasePath(event.requestContext.http.path);
    }
  }
  return event;
}

export const handler = async (event, context) => {
  const serverlessHandler = await loadHandler();
  if (process.env.ENABLE_BASE_PATH_STRIP === 'true') {
    normalizeEventPath(event);
  }
  return serverlessHandler(event, context);
};

export default handler;
