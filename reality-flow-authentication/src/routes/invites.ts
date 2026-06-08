import { Router } from 'express';
import {
  createInviteHandler,
  listInvitesHandler,
  revokeInviteHandler,
  updateInviteEmailHandler,
} from '../controllers/inviteController';

const router = Router();

router.post('/', createInviteHandler);
router.patch('/:inviteCode/email', updateInviteEmailHandler);
router.get('/', listInvitesHandler);
router.post('/:inviteCode/revoke', revokeInviteHandler);

export default router;
