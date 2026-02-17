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

export default router;
