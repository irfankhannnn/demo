// AWS Lambda Handler for AI Calling Service

import serverless from 'serverless-http';
import { hydrateConfigFromSecrets } from './config/secretsBootstrap.js';

// server.js (the Express app) and everything it imports read process.env.X at
// module-load time in several places, so it can only be imported AFTER
// Secrets Manager hydration has populated process.env — a static top-level
// `import` would run before hydrateConfigFromSecrets() ever gets a chance to.
// This memoized dynamic import runs that hydration first, once per container,
// and every subsequent invocation reuses the same resolved module (dynamic
// import() is itself cached by the module loader).
let handlerPromise = null;

function loadHandler() {
  if (!handlerPromise) {
    handlerPromise = hydrateConfigFromSecrets()
      .then(() => import('./server.js'))
      .then((serverModule) =>
        serverless(serverModule.default, {
          binary: ['image/*', 'audio/*', 'video/*'],
        })
      );
  }
  return handlerPromise;
}

/**
 * Strips the configured base path from a request path.
 *
 * When the API is fronted by a custom domain with a base-path mapping, API
 * Gateway forwards the base path as part of the request path (e.g.
 * /devrealestateagencyai/api/ai-calling/calls/start) while Express routes are
 * registered under /api/ai-calling/... Without this, every request 404s once
 * the custom domain mapping is switched on.
 *
 * Mirrors stripConfiguredBasePath in apps/crm/server/lambda-handler.js.
 */
function stripBasePath(pathValue) {
  if (!pathValue || typeof pathValue !== 'string') {
    return pathValue;
  }

  const prefix = (process.env.API_BASE_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');
  if (!prefix) {
    return pathValue;
  }

  const basePath = `/${prefix}`;
  if (pathValue === basePath) {
    return '/';
  }
  if (pathValue.startsWith(`${basePath}/`)) {
    return pathValue.slice(basePath.length) || '/';
  }

  return pathValue;
}

/**
 * Normalizes every path field the event carries, so whichever one
 * serverless-http reads has already been stripped.
 */
function normalizeEventPath(event) {
  if (!event || typeof event !== 'object') {
    return event;
  }

  if (typeof event.path === 'string') {
    event.path = stripBasePath(event.path);
  }

  if (typeof event.rawPath === 'string') {
    event.rawPath = stripBasePath(event.rawPath);
  }

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
  // Must be first: ENABLE_BASE_PATH_STRIP and API_BASE_PATH_PREFIX are read
  // below, and hydration is what guarantees process.env is populated.
  const serverlessHandler = await loadHandler();

  // Only strip when the deployment actually maps a base path into the
  // forwarded request path. Default off, matching apps/crm/server/lambda-handler.js.
  if (process.env.ENABLE_BASE_PATH_STRIP === 'true') {
    normalizeEventPath(event);
  }

  return serverlessHandler(event, context);
};

export default handler;
