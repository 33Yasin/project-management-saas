import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireWorkspaceRole } from '../../middleware/require-workspace-role';
import { requireProjectAccess } from '../../middleware/require-project-access';
import { validate } from '../../middleware/validate';
import { projectsController } from './projects.controller';
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
} from './projects.schemas';
import { workspaceIdParamSchema } from '../workspaces/workspaces.schemas';
import { projectTasksRouter } from '../tasks/tasks.routes';

// Workspace-scoped router (/api/workspaces/:workspaceId/projects)
export const workspaceProjectsRouter = Router({ mergeParams: true });

// All workspace members (OWNER, ADMIN, MEMBER) have access
workspaceProjectsRouter.use(requireWorkspaceRole());

workspaceProjectsRouter.get(
  '/',
  validate({ params: workspaceIdParamSchema }),
  (req, res, next) => {
    projectsController.list(req, res, next);
  }
);

workspaceProjectsRouter.post(
  '/',
  requireWorkspaceRole(['OWNER', 'ADMIN']),
  validate({ params: workspaceIdParamSchema, body: createProjectSchema }),
  (req, res, next) => {
    projectsController.create(req, res, next);
  }
);

// Direct project router (/api/projects)
export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get(
  '/:projectId',
  validate({ params: projectIdParamSchema }),
  requireProjectAccess,
  (req, res, next) => {
    projectsController.getById(req, res, next);
  }
);

projectsRouter.patch(
  '/:projectId',
  validate({ params: projectIdParamSchema, body: updateProjectSchema }),
  requireProjectAccess(['OWNER', 'ADMIN']),
  (req, res, next) => {
    projectsController.update(req, res, next);
  }
);

projectsRouter.delete(
  '/:projectId',
  validate({ params: projectIdParamSchema }),
  requireProjectAccess(['OWNER', 'ADMIN']),
  (req, res, next) => {
    projectsController.delete(req, res, next);
  }
);

// Nested routes for tasks
projectsRouter.use('/:projectId/tasks', projectTasksRouter);

export default projectsRouter;
