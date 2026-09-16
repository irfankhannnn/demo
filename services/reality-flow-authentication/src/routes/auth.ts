import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/requireAuth';
import {
  bootstrap,
  registerAdmin,
  checkInvite,
  acceptInvite,
  me,
  patchProfile,
  patchAgency,
} from '../controllers/authController';
import { exchangeToken, refreshToken } from '../controllers/tokenController';
import {
  selfEmailStart,
  selfPhoneStart,
  selfPhoneVerify,
} from '../controllers/contactLinkController';
import {
  deleteMyAccountHandler,
  deletionPreviewHandler,
} from '../controllers/accountController';

const router = Router();

// HIGH-5 fix: Add rate limiting to token endpoints
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many token requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => process.env.ENV === 'dev', // Skip in dev
});

// Token endpoints (no auth required - these ARE the auth endpoints)
router.post('/token', tokenLimiter, exchangeToken);
router.post('/refresh', tokenLimiter, refreshToken);

// Protected endpoints (require valid token)
router.post('/bootstrap', requireAuth, bootstrap);
router.post('/register-admin', requireAuth, registerAdmin);
router.get('/check-invite', requireAuth, checkInvite);
router.post('/accept-invite', requireAuth, acceptInvite);
router.get('/me', requireAuth, me);
router.patch('/profile', requireAuth, patchProfile);
router.patch('/agency', requireAuth, patchAgency);

// Self-service account deletion — App Store guideline 5.1.1(v) and Google
// Play's data deletion policy both require this to be reachable in-app.
router.get('/me/deletion-preview', requireAuth, deletionPreviewHandler);
router.delete('/me', requireAuth, deleteMyAccountHandler);

// Self-service contact linking
router.post('/profile/contact/email/start', requireAuth, selfEmailStart);
router.post('/profile/contact/phone/start', requireAuth, selfPhoneStart);
router.post('/profile/contact/phone/verify', requireAuth, selfPhoneVerify);

export default router;
