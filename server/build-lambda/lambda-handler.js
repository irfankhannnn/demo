import serverlessExpress from '@vendia/serverless-express';
import app from './server.js';

let serverlessExpressInstance;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Max-Age': '86400'
};

function normalizeSingleValueHeader(key, value) {
  if (value == null) return value;

  // API Gateway/Lambda can end up returning duplicated header values when both
  // `headers` and `multiValueHeaders` are present. Browsers reject this for ACAO.
  if (key.toLowerCase() === 'access-control-allow-origin') {
    if (Array.isArray(value)) return String(value[0]);
    const s = String(value);
    return s.split(',')[0].trim();
  }

  if (Array.isArray(value)) return value.join(',');
  return value;
}

function canonicalCorsHeaderKey(lowerKey) {
  switch (lowerKey) {
    case 'access-control-allow-origin':
      return 'Access-Control-Allow-Origin';
    case 'access-control-allow-methods':
      return 'Access-Control-Allow-Methods';
    case 'access-control-allow-headers':
      return 'Access-Control-Allow-Headers';
    case 'access-control-max-age':
      return 'Access-Control-Max-Age';
    default:
      return null;
  }
}

function dedupeHeadersCaseInsensitive(headers) {
  if (!headers || typeof headers !== 'object') return {};

  const out = {};
  const seen = new Map(); // lowerKey -> canonicalKey

  for (const [k, v] of Object.entries(headers)) {
    const lower = String(k).toLowerCase();
    const canonicalCors = canonicalCorsHeaderKey(lower);
    const targetKey = canonicalCors || k;

    if (!seen.has(lower)) {
      seen.set(lower, targetKey);
      out[targetKey] = normalizeSingleValueHeader(targetKey, v);
      continue;
    }

    // Merge duplicates deterministically. For CORS headers we always keep a single value.
    const existingKey = seen.get(lower);
    if (lower === 'access-control-allow-origin') {
      // Keep the first value (after normalization) and ignore subsequent duplicates.
      continue;
    }

    const existingVal = out[existingKey];
    const nextVal = normalizeSingleValueHeader(existingKey, v);
    if (existingVal == null) {
      out[existingKey] = nextVal;
    } else if (nextVal != null && String(existingVal) !== String(nextVal)) {
      out[existingKey] = `${existingVal},${nextVal}`;
    }
  }

  return out;
}

export const handler = async (event, context) => {
  // Handle OPTIONS preflight requests directly
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // Ensure we always have a correlation id available to Express + logs
  event.headers = event.headers || {};
  if (!event.headers['x-request-id'] && !event.headers['X-Request-Id']) {
    event.headers['x-request-id'] = context?.awsRequestId;
  }

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
  const response = await serverlessExpressInstance(event, context);

  // Normalize multi-value headers into single headers to avoid duplicates like "*, *"
  // in Access-Control-Allow-Origin.
  response.headers = response.headers || {};
  if (response.multiValueHeaders && typeof response.multiValueHeaders === 'object') {
    for (const [k, v] of Object.entries(response.multiValueHeaders)) {
      if (response.headers[k] == null) {
        response.headers[k] = normalizeSingleValueHeader(k, v);
      }
    }
    delete response.multiValueHeaders;
  }

  // Add CORS headers to all responses
  response.headers = {
    ...response.headers,
    ...CORS_HEADERS
  };

  // Remove duplicate headers that differ only by casing and canonicalize CORS header keys.
  response.headers = dedupeHeadersCaseInsensitive(response.headers);

  // Ensure ACAO is a single valid value (not a comma-separated list)
  response.headers['Access-Control-Allow-Origin'] = normalizeSingleValueHeader(
    'Access-Control-Allow-Origin',
    response.headers['Access-Control-Allow-Origin']
  );

  return response;
};
