import { Router } from 'express';
import { deleteUserHandler, listUsersHandler } from '../controllers/usersController';
import { adminEmailStart, adminPhoneStart } from '../controllers/contactLinkController';

const router = Router();

router.get('/', listUsersHandler);
router.delete('/:userId', deleteUserHandler);

// Admin-managed contact linking
router.post('/:userId/contact/email/start', adminEmailStart);
router.post('/:userId/contact/phone/start', adminPhoneStart);

export default router;
