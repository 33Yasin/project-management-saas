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
} from './tasks.schemas';
import { projectIdParamSchema } from '../projects/projects.schemas';

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

tasksRouter.delete(
  '/:taskId',
  validate({ params: taskIdParamSchema }),
  requireTaskAccess,
  (req, res, next) => {
    tasksController.delete(req, res, next);
  }
);

export default tasksRouter;
