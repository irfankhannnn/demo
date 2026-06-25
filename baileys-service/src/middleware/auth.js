import { BAILEYS_API_KEY } from '../config.js';
import { logger } from '../logger.js';

export function requireApiKey(req, res, next) {
  if (!BAILEYS_API_KEY) {
    logger.error('auth.missing_key');
    return res.status(500).json({ error: 'misconfigured_auth' });
  }

  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'];
  if (!provided || provided !== BAILEYS_API_KEY) {
    logger.warn('auth.denied', { 
      path: req.path, 
      ip: req.ip,
      hasProvided: !!provided 
    });
    return res.status(401).json({ error: 'unauthorized' });
  }

  next();
}
