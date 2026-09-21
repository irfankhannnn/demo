import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { tokenLimiter, deleteLimiter } from '../middleware/rateLimit';
import { exchangeToken, refreshToken, logout } from '../controllers/tokenController';
import { me, patchProfile, deleteMe } from '../controllers/profileController';

const router = Router();

// Mounted at /auth.
// Public — these issue or end sessions.
router.post('/token', tokenLimiter, exchangeToken);
router.post('/refresh', tokenLimiter, refreshToken);
router.post('/logout', logout);

// Bearer-protected.
router.get('/me', requireAuth, me);
router.patch('/profile', requireAuth, patchProfile);
router.delete('/me', deleteLimiter, requireAuth, deleteMe);

export default router;
