/**
 * Phone authentication routes (Cognito Custom Auth only)
 *
 * POST /auth/phone/start   – public, initiates OTP
 * POST /auth/phone/confirm  – public, verifies OTP + returns tokens + existingUser/needsOnboarding
 * POST /auth/phone/onboard  – authenticated, registers new user (admin or invited member)
 */

import { Router } from 'express';
import { startPhoneAuthHandler, confirmPhoneAuthHandler, onboardPhoneUserHandler } from '../controllers/phoneAuthCustomController';

const router = Router();

router.post('/start', startPhoneAuthHandler);
router.post('/confirm', confirmPhoneAuthHandler);
router.post('/onboard', onboardPhoneUserHandler); // requires valid access token

export default router;
