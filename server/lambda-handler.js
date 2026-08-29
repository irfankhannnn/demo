import serverlessExpress from '@vendia/serverless-express';
import { hydrateConfigFromSsm } from './config/ssmBootstrap.js';

let serverlessExpressInstance;

// server.js (the Express app) and everything it imports read process.env.X
// at module-load time in many places, so it can only be require'd/imported
// AFTER SSM hydration has populated process.env — a static top-level
// `import` would run before hydrateConfigFromSsm() ever gets a chance to.
// This memoized dynamic import runs that hydration first, once per
// container, and every subsequent invocation reuses the same resolved
// modules (dynamic import() is itself cached by the module loader).
let appModulesPromise;
async function loadAppModules() {
  if (!appModulesPromise) {
    appModulesPromise = hydrateConfigFromSsm().then(() =>
      Promise.all([
        import('./server.js'),
        import('./utils/response.js'),
        import('./lib/sentry.js'),
        import('./lib/posthog.js'),
      ])
    );
  }
  const [serverModule, responseModule, sentryModule, posthogModule] = await appModulesPromise;
  return {
    app: serverModule.default,
    applyCorsHeaders: responseModule.applyCorsHeaders,
    buildResponse: responseModule.buildResponse,
    captureServerException: sentryModule.captureServerException,
    flushSentry: sentryModule.flushSentry,
    shutdownPostHog: posthogModule.shutdownPostHog,
  };
}

/**
 * Strips configured base paths from the request path.
 * Used when API Gateway base path mapping includes the base path (e.g., custom domain with base path = "api").
 * @param {string} pathValue - The path to normalize
 * @returns {string} The normalized path
 */
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

/**
 * Normalizes event path fields by stripping configured base paths.
 * Only called if ENABLE_BASE_PATH_STRIP is explicitly set to 'true'.
 * @param {object} event - The Lambda event
 */
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

/**
 * Validates and deletes the pathParameters.proxy if present.
 * This is a workaround for @vendia/serverless-express nested proxy bug.
 * @param {object} event - The Lambda event
 */
function deleteProxyParameterIfValid(event) {
  if (!event?.requestContext?.apiId || !event?.pathParameters?.proxy) {
    return;
  }

  const proxy = event.pathParameters.proxy;
  
  // Validate proxy parameter: must be a non-empty string under 1000 chars
  if (typeof proxy === 'string' && proxy.length > 0 && proxy.length < 1000) {
    delete event.pathParameters.proxy;
  }
}

function getEventOrigin(event) {
  const headers = event?.headers || {};
  return headers.origin || headers.Origin || null;
}

export const handler = async (event, context) => {
  // Must be first: process.env.ENABLE_BASE_PATH_STRIP below (and everything
  // server.js itself reads) may come from SSM, not a real Lambda env var.
  const { app, applyCorsHeaders, buildResponse, captureServerException, flushSentry, shutdownPostHog } =
    await loadAppModules();

  const requestOrigin = getEventOrigin(event);

  // Handle OPTIONS preflight requests directly (allowlisted origins only)
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, '', {}, requestOrigin);
  }

  // Ensure we always have a correlation id available to Express + logs
  event.headers = event.headers || {};
  if (!event.headers['x-request-id'] && !event.headers['X-Request-Id']) {
    event.headers['x-request-id'] = context?.awsRequestId;
  }

  // Conditional base path stripping: only if API Gateway base path mapping
  // includes the base path (e.g., custom domain with base path = "api").
  // Default is false to support current deployment where base path is NOT included.
  // Set ENABLE_BASE_PATH_STRIP=true only if API Gateway base path mapping includes /api.
  const shouldStripBasePath = process.env.ENABLE_BASE_PATH_STRIP === 'true';
  if (shouldStripBasePath) {
    normalizeEventPath(event);
  }

  // Workaround for @vendia/serverless-express: when API Gateway uses a nested
  // proxy resource like /api/{proxy+}, the library uses pathParameters.proxy
  // as the request path (e.g., /ai-integrations) instead of the full event.path
  // (e.g., /api/ai-integrations). Deleting proxy forces it to use event.path.
  // Guarded to API Gateway events only (requestContext.apiId is present) so
  // ALB/Lambda@Edge events are not affected if they ever use this handler.
  deleteProxyParameterIfValid(event);

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
    return applyCorsHeaders(response, requestOrigin);
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
