/**
 * Phone authentication routes (Cognito Custom Auth only)
 *
 * POST /auth/phone/start   – public, initiates OTP
 * POST /auth/phone/confirm  – public, verifies OTP + returns tokens + existingUser/needsOnboarding
 * POST /auth/phone/onboard  – authenticated, registers new user (admin or invited member)
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { startPhoneAuthHandler, confirmPhoneAuthHandler, onboardPhoneUserHandler } from '../controllers/phoneAuthCustomController';

const router = Router();

// HIGH-5 fix: Add rate limiting to prevent OTP spam and brute-force attacks
// Stricter limits on OTP initiation (3 per 15 min per IP)
const startOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: 'Too many OTP requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => process.env.ENV === 'dev', // Skip in dev
});

// Moderate limits on OTP confirmation (5 per 15 min per IP)
const confirmOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many OTP confirmation attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => process.env.ENV === 'dev', // Skip in dev
});

router.post('/start', startOtpLimiter, startPhoneAuthHandler);
router.post('/confirm', confirmOtpLimiter, confirmPhoneAuthHandler);
router.post('/onboard', onboardPhoneUserHandler); // requires valid access token

export default router;
