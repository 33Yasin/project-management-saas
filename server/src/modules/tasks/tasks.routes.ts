import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireProjectAccess } from '../../middleware/require-project-access';
import { requireTaskAccess } from '../../middleware/require-task-access';
import { validate } from '../../middleware/validate';
import { tasksController } from './tasks.controller';
import {
  createTaskSchema,
  updateTaskSchema,
  taskListQuerySchema,
  taskIdParamSchema,
  moveTaskSchema,
} from './tasks.schemas';
import { projectIdParamSchema } from '../projects/projects.schemas';
import { taskCommentsRouter } from '../comments/comments.routes';
import { taskActivitiesRouter } from '../activities/activity.routes';
import { taskAttachmentsRouter } from '../attachments/attachment.routes';

// Project-scoped router (/api/projects/:projectId/tasks)
export const projectTasksRouter = Router({ mergeParams: true });

projectTasksRouter.use(requireAuth);
projectTasksRouter.use(validate({ params: projectIdParamSchema }));
projectTasksRouter.use(requireProjectAccess);

projectTasksRouter.get(
  '/',
  validate({ query: taskListQuerySchema }),
  (req, res, next) => {
    tasksController.list(req, res, next);
  }
);

projectTasksRouter.post(
  '/',
  validate({ body: createTaskSchema }),
  (req, res, next) => {
    tasksController.create(req, res, next);
  }
);

// Direct tasks router (/api/tasks)
export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get(
  '/:taskId',
  validate({ params: taskIdParamSchema }),
  requireTaskAccess,
  (req, res, next) => {
    tasksController.getById(req, res, next);
  }
);

tasksRouter.patch(
  '/:taskId',
  validate({ params: taskIdParamSchema, body: updateTaskSchema }),
  requireTaskAccess,
  (req, res, next) => {
    tasksController.update(req, res, next);
  }
);

tasksRouter.patch(
  '/:taskId/move',
  validate({ params: taskIdParamSchema, body: moveTaskSchema }),
  requireTaskAccess,
  (req, res, next) => {
    tasksController.move(req, res, next);
  }
);

tasksRouter.delete(
  '/:taskId',
  validate({ params: taskIdParamSchema }),
  requireTaskAccess,
  (req, res, next) => {
    tasksController.delete(req, res, next);
  }
);

// Nested routes for comments
tasksRouter.use('/:taskId/comments', taskCommentsRouter);

// Nested routes for activities
tasksRouter.use('/:taskId/activities', taskActivitiesRouter);

// Nested routes for attachments
tasksRouter.use('/:taskId/attachments', taskAttachmentsRouter);

export default tasksRouter;
