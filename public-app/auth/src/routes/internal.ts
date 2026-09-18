import { Router } from 'express';
import { requireInternalApiKey } from '../middleware/internalApiKey';
import { getInternalUser } from '../controllers/internalController';

const router = Router();

// Mounted at /internal — service-to-service only (x-internal-api-key), never from a browser.
router.use(requireInternalApiKey);
router.get('/users/:userId', getInternalUser);

export default router;
