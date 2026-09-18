import { Router } from 'express';
import { getGoogleAuthUrl } from '../controllers/googleAuthController';

const router = Router();

// Mounted at /auth/google — public.
router.get('/url', getGoogleAuthUrl);

export default router;
