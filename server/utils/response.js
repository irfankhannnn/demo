export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Max-Age': '86400'
};

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
    if (lower === 'access-control-allow-origin') {
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

export function buildResponse(statusCode, body, headers = {}) {
  return applyCorsHeaders({
    statusCode,
    headers,
    body: body === '' ? '' : JSON.stringify(body)
  });
}

export function applyCorsHeaders(response = {}) {
  const normalizedResponse = {
    ...response,
    headers: response.headers || {}
  };

  if (normalizedResponse.multiValueHeaders && typeof normalizedResponse.multiValueHeaders === 'object') {
    for (const [k, v] of Object.entries(normalizedResponse.multiValueHeaders)) {
      if (normalizedResponse.headers[k] == null) {
        normalizedResponse.headers[k] = normalizeSingleValueHeader(k, v);
      }
    }
    delete normalizedResponse.multiValueHeaders;
  }

  normalizedResponse.headers = {
    ...normalizedResponse.headers,
    ...CORS_HEADERS
  };

  normalizedResponse.headers = dedupeHeadersCaseInsensitive(normalizedResponse.headers);
  normalizedResponse.headers['Access-Control-Allow-Origin'] = normalizeSingleValueHeader(
    'Access-Control-Allow-Origin',
    normalizedResponse.headers['Access-Control-Allow-Origin']
  );

  return normalizedResponse;
}
