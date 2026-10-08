import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { validate } from '../../middleware/validate';
import {
  notificationListQuerySchema,
  notificationIdParamSchema,
} from './notification.schemas';
import { notificationController } from './notification.controller';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  validate({ query: notificationListQuerySchema }),
  (req, res, next) => {
    notificationController.list(req, res, next);
  }
);

notificationsRouter.patch(
  '/:notificationId/read',
  validate({ params: notificationIdParamSchema }),
  (req, res, next) => {
    notificationController.markRead(req, res, next);
  }
);

notificationsRouter.post('/read-all', (req, res, next) => {
  notificationController.markAllRead(req, res, next);
});

export default notificationsRouter;
