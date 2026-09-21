import type { AuthContext } from '../middleware/authMiddleware';

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth after a successful JWT verification. */
      auth?: AuthContext;
    }
  }
}

export {};
