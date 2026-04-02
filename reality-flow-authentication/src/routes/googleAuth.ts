import { Router } from 'express';
import { getGoogleAuthUrl } from '../controllers/googleAuthController';

const router = Router();

// Public endpoint (no auth required)
// GET /auth/google/url?redirect_uri=xxx&state=xxx
router.get('/url', getGoogleAuthUrl);

export default router;
