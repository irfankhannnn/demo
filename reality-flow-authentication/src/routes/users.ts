import { Router } from 'express';
import { deleteUserHandler, listUsersHandler } from '../controllers/usersController';

const router = Router();

router.get('/', listUsersHandler);
router.delete('/:sub', deleteUserHandler);

export default router;
