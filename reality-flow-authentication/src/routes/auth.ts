import { Router } from 'express';
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

const router = Router();

// Token endpoints (no auth required - these ARE the auth endpoints)
router.post('/token', exchangeToken);
router.post('/refresh', refreshToken);

// Protected endpoints (require valid token)
router.post('/bootstrap', bootstrap);
router.post('/register-admin', registerAdmin);
router.get('/check-invite', checkInvite);
router.post('/accept-invite', acceptInvite);
router.get('/me', me);
router.patch('/profile', patchProfile);
router.patch('/agency', patchAgency);

// Self-service contact linking
router.post('/profile/contact/email/start', selfEmailStart);
router.post('/profile/contact/phone/start', selfPhoneStart);
router.post('/profile/contact/phone/verify', selfPhoneVerify);

export default router;
