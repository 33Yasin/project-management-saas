import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireWorkspaceRole } from '../../middleware/require-workspace-role';
import { validate } from '../../middleware/validate';
import { workspacesController } from './workspaces.controller';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  transferOwnershipSchema,
  workspaceIdParamSchema,
} from './workspaces.schemas';

const router = Router();

// All workspace routes require authenticated session
router.use(requireAuth);

router.get('/', (req, res, next) => {
  workspacesController.list(req, res, next);
});

router.post(
  '/',
  validate({ body: createWorkspaceSchema }),
  (req, res, next) => {
    workspacesController.create(req, res, next);
  }
);

router.get(
  '/:workspaceId',
  validate({ params: workspaceIdParamSchema }),
  requireWorkspaceRole(),
  (req, res, next) => {
    workspacesController.getById(req, res, next);
  }
);

router.patch(
  '/:workspaceId',
  validate({ params: workspaceIdParamSchema, body: updateWorkspaceSchema }),
  requireWorkspaceRole(['OWNER', 'ADMIN']),
  (req, res, next) => {
    workspacesController.update(req, res, next);
  }
);

router.delete(
  '/:workspaceId',
  validate({ params: workspaceIdParamSchema }),
  requireWorkspaceRole(['OWNER']),
  (req, res, next) => {
    workspacesController.delete(req, res, next);
  }
);

router.post(
  '/:workspaceId/transfer-ownership',
  validate({ params: workspaceIdParamSchema, body: transferOwnershipSchema }),
  requireWorkspaceRole(['OWNER']),
  (req, res, next) => {
    workspacesController.transferOwnership(req, res, next);
  }
);

export default router;
