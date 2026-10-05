import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireTaskAccess } from '../../middleware/require-task-access';
import { validate } from '../../middleware/validate';
import { commentsController } from './comments.controller';
import {
  createCommentSchema,
  commentIdParamSchema,
} from './comments.schemas';
import { taskIdParamSchema } from '../tasks/tasks.schemas';

// Task-scoped router (/api/tasks/:taskId/comments)
export const taskCommentsRouter = Router({ mergeParams: true });

taskCommentsRouter.use(requireAuth);
taskCommentsRouter.use(validate({ params: taskIdParamSchema }));
taskCommentsRouter.use(requireTaskAccess);

taskCommentsRouter.get('/', (req, res, next) => {
  commentsController.list(req, res, next);
});

taskCommentsRouter.post(
  '/',
  validate({ body: createCommentSchema }),
  (req, res, next) => {
    commentsController.create(req, res, next);
  }
);

// Direct comments router (/api/comments)
export const commentsRouter = Router();

commentsRouter.use(requireAuth);

commentsRouter.delete(
  '/:commentId',
  validate({ params: commentIdParamSchema }),
  (req, res, next) => {
    commentsController.delete(req, res, next);
  }
);

export default commentsRouter;
