import { Response } from 'express';

export function ok(res: Response, data: unknown) {
  return res.status(200).json(data);
}

export function created(res: Response, data: unknown) {
  return res.status(201).json(data);
}

export function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: 'Bad Request', message });
}

export function unauthorized(res: Response, message = 'Unauthorized') {
  return res.status(401).json({ error: 'Unauthorized', message });
}

export function forbidden(res: Response, code: string, message = 'Forbidden') {
  return res.status(403).json({ error: 'Forbidden', code, message });
}

export function notFound(res: Response, message = 'Not Found') {
  return res.status(404).json({ error: 'Not Found', message });
}

export function conflict(res: Response, message: string) {
  return res.status(409).json({ error: 'Conflict', message });
}

export function internalError(res: Response, message = 'Internal Server Error') {
  return res.status(500).json({ error: 'Internal Server Error', message });
}

export function tooManyRequests(res: Response, message = 'Too Many Requests') {
  return res.status(429).json({ error: 'Too Many Requests', message });
}
