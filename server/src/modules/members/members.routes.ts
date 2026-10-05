import { Router } from 'express';
import { requireWorkspaceRole } from '../../middleware/require-workspace-role';
import { validate } from '../../middleware/validate';
import { membersController } from './members.controller';
import { memberIdParamSchema, updateMemberRoleSchema } from './members.schemas';
import { workspaceIdParamSchema } from '../workspaces/workspaces.schemas';

const router = Router({ mergeParams: true });

// GET /api/workspaces/:workspaceId/members
// Allowed: OWNER, ADMIN, MEMBER
router.get(
  '/',
  validate({ params: workspaceIdParamSchema }),
  requireWorkspaceRole(),
  (req, res, next) => {
    membersController.list(req, res, next);
  }
);

// PATCH /api/workspaces/:workspaceId/members/:memberId
// Allowed: OWNER, ADMIN
router.patch(
  '/:memberId',
  validate({ params: memberIdParamSchema, body: updateMemberRoleSchema }),
  requireWorkspaceRole(['OWNER', 'ADMIN']),
  (req, res, next) => {
    membersController.updateRole(req, res, next);
  }
);

// DELETE /api/workspaces/:workspaceId/members/:memberId
// Allowed: OWNER, ADMIN
router.delete(
  '/:memberId',
  validate({ params: memberIdParamSchema }),
  requireWorkspaceRole(['OWNER', 'ADMIN']),
  (req, res, next) => {
    membersController.remove(req, res, next);
  }
);

export default router;
