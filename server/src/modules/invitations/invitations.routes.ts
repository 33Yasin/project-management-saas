import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireWorkspaceRole } from '../../middleware/require-workspace-role';
import { validate } from '../../middleware/validate';
import { invitationsController } from './invitations.controller';
import {
  createInvitationSchema,
  invitationIdParamSchema,
  tokenParamSchema,
} from './invitations.schemas';
import { workspaceIdParamSchema } from '../workspaces/workspaces.schemas';

// Workspace-scoped router (/api/workspaces/:workspaceId/invitations)
export const workspaceInvitationsRouter = Router({ mergeParams: true });

workspaceInvitationsRouter.use(requireWorkspaceRole(['OWNER', 'ADMIN']));

// GET /api/workspaces/:workspaceId/invitations
workspaceInvitationsRouter.get(
  '/',
  validate({ params: workspaceIdParamSchema }),
  (req, res, next) => {
    invitationsController.list(req, res, next);
  }
);

// POST /api/workspaces/:workspaceId/invitations
workspaceInvitationsRouter.post(
  '/',
  validate({ params: workspaceIdParamSchema, body: createInvitationSchema }),
  (req, res, next) => {
    invitationsController.create(req, res, next);
  }
);

// DELETE /api/workspaces/:workspaceId/invitations/:invitationId
workspaceInvitationsRouter.delete(
  '/:invitationId',
  validate({ params: invitationIdParamSchema }),
  (req, res, next) => {
    invitationsController.revoke(req, res, next);
  }
);

// Global token-scoped router (/api/invitations)
export const invitationsRouter = Router();

// GET /api/invitations/:token/preview (Public)
invitationsRouter.get(
  '/:token/preview',
  validate({ params: tokenParamSchema }),
  (req, res, next) => {
    invitationsController.preview(req, res, next);
  }
);

// POST /api/invitations/:token/accept (Requires authentication)
invitationsRouter.post(
  '/:token/accept',
  requireAuth,
  validate({ params: tokenParamSchema }),
  (req, res, next) => {
    invitationsController.accept(req, res, next);
  }
);

export default invitationsRouter;
