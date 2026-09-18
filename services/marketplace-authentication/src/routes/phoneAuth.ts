import { Router } from 'express';
import { startPhoneAuthHandler, confirmPhoneAuthHandler } from '../controllers/phoneAuthController';
import { phoneStartLimiter, phoneConfirmLimiter } from '../middleware/rateLimit';

const router = Router();

// Mounted at /auth/phone — both public: they ARE the login.
router.post('/start', phoneStartLimiter, startPhoneAuthHandler);
router.post('/confirm', phoneConfirmLimiter, confirmPhoneAuthHandler);

export default router;
