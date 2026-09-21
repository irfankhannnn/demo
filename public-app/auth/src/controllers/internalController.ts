import { Request, Response } from 'express';
import { ok, notFound, badRequest, internalError } from '../utils/http';
import { logger } from '../utils/logger';
import { findUserById, toPublicUser } from '../models/usersModel';

/**
 * GET /internal/users/:userId  (x-internal-api-key)
 * Lets marketplace-api / the CRM resolve a consumer's contact details
 * from the userId (= Cognito sub) they hold. Deleted users read as 404.
 */
export async function getInternalUser(req: Request, res: Response): Promise<void> {
  const userId = String(req.params.userId ?? '').trim();
  if (!userId || userId.length > 128) {
    badRequest(res, 'userId is required', 'validation_error');
    return;
  }
  try {
    const user = await findUserById(userId);
    if (!user || user.status === 'DELETED') {
      notFound(res, 'User not found', 'user_not_found');
      return;
    }
    ok(res, { user: toPublicUser(user) });
  } catch (error) {
    logger.error('internal.get_user.failed', { userId, error });
    internalError(res, 'Could not load user');
  }
}
