import { Response } from 'express';

/**
 * Error envelope per docs/public-app/api/API-CONTRACT.md:
 * `{ error: string, details?: string }`. `error` is a stable machine code,
 * `details` is human-readable. `extra` lets a handler attach one more
 * field when the client needs it (e.g. a fresh Cognito `session` on a
 * wrong-OTP response).
 */
export function fail(
  res: Response,
  status: number,
  error: string,
  details?: string,
  extra?: Record<string, unknown>
) {
  return res.status(status).json({ error, ...(details ? { details } : {}), ...(extra || {}) });
}

export function ok(res: Response, data: unknown) {
  return res.status(200).json(data);
}

export function badRequest(res: Response, details: string, error = 'bad_request', extra?: Record<string, unknown>) {
  return fail(res, 400, error, details, extra);
}

export function unauthorized(res: Response, details = 'Unauthorized', error = 'unauthorized') {
  return fail(res, 401, error, details);
}

export function forbidden(res: Response, details = 'Forbidden', error = 'forbidden') {
  return fail(res, 403, error, details);
}

export function notFound(res: Response, details = 'Not found', error = 'not_found') {
  return fail(res, 404, error, details);
}

export function conflict(res: Response, details: string, error = 'conflict') {
  return fail(res, 409, error, details);
}

export function tooManyRequests(res: Response, details = 'Too many requests', error = 'rate_limited') {
  return fail(res, 429, error, details);
}

export function internalError(res: Response, details = 'Internal server error', error = 'internal_error') {
  return fail(res, 500, error, details);
}
