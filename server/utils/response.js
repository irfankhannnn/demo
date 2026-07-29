import { buildCorsHeaders } from './corsOrigins.js';

function normalizeSingleValueHeader(key, value) {
  if (value == null) return value;

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
    case 'access-control-allow-credentials':
      return 'Access-Control-Allow-Credentials';
    default:
      return null;
  }
}

function dedupeHeadersCaseInsensitive(headers) {
  if (!headers || typeof headers !== 'object') return {};

  const out = {};
  const seen = new Map();

  for (const [k, v] of Object.entries(headers)) {
    const lower = String(k).toLowerCase();
    const canonicalCors = canonicalCorsHeaderKey(lower);
    const targetKey = canonicalCors || k;

    if (!seen.has(lower)) {
      seen.set(lower, targetKey);
      out[targetKey] = normalizeSingleValueHeader(targetKey, v);
      continue;
    }

    const existingKey = seen.get(lower);
    if (lower === 'access-control-allow-origin' || lower === 'access-control-allow-credentials') {
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

/**
 * @param {number} statusCode
 * @param {*} body
 * @param {object} [headers]
 * @param {string|null} [requestOrigin]
 */
export function buildResponse(statusCode, body, headers = {}, requestOrigin = null) {
  return applyCorsHeaders({
    statusCode,
    headers,
    body: body === '' ? '' : JSON.stringify(body),
  }, requestOrigin);
}

/**
 * Merge allowlisted CORS headers onto a Lambda proxy response.
 * Never sets Access-Control-Allow-Origin: * (incompatible with credentials).
 *
 * @param {object} response
 * @param {string|null} [requestOrigin]
 */
export function applyCorsHeaders(response = {}, requestOrigin = null) {
  const normalizedResponse = {
    ...response,
    headers: response.headers || {},
  };

  if (normalizedResponse.multiValueHeaders && typeof normalizedResponse.multiValueHeaders === 'object') {
    for (const [k, v] of Object.entries(normalizedResponse.multiValueHeaders)) {
      if (normalizedResponse.headers[k] == null) {
        normalizedResponse.headers[k] = normalizeSingleValueHeader(k, v);
      }
    }
    delete normalizedResponse.multiValueHeaders;
  }

  const cors = buildCorsHeaders(requestOrigin);
  normalizedResponse.headers = {
    ...normalizedResponse.headers,
    ...cors,
  };

  // If origin was not allowlisted, strip any inherited ACAO
  if (!cors['Access-Control-Allow-Origin']) {
    delete normalizedResponse.headers['Access-Control-Allow-Origin'];
    delete normalizedResponse.headers['access-control-allow-origin'];
    delete normalizedResponse.headers['Access-Control-Allow-Credentials'];
  }

  normalizedResponse.headers = dedupeHeadersCaseInsensitive(normalizedResponse.headers);

  return normalizedResponse;
}
