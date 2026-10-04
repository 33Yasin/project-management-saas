import { Request, Response, NextFunction } from 'express';
import { WorkspaceRole } from '@prisma/client';
import prisma from '../lib/db/prisma';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

export function requireWorkspaceRole(allowedRoles?: WorkspaceRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return next(
          AppError.unauthenticated('Authentication required.', ErrorCode.AUTH_REQUIRED)
        );
      }

      const rawWorkspaceId = req.params.workspaceId;
      const workspaceId = Array.isArray(rawWorkspaceId) ? rawWorkspaceId[0] : rawWorkspaceId;
      if (!workspaceId) {
        return next(
          AppError.badRequest('Workspace ID is required.', ErrorCode.VALIDATION_ERROR)
        );
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId,
          },
        },
      });

      if (!membership) {
        // Return 404 to avoid leaking existence of private workspaces
        return next(
          AppError.notFound(
            'Workspace not found or access denied.',
            ErrorCode.WORKSPACE_NOT_FOUND
          )
        );
      }

      if (allowedRoles && !allowedRoles.includes(membership.role)) {
        if (allowedRoles.length === 1 && allowedRoles[0] === 'OWNER') {
          return next(
            AppError.unauthorized(
              'Only the workspace owner can perform this action.',
              ErrorCode.OWNER_REQUIRED
            )
          );
        }

        return next(
          AppError.unauthorized(
            'You do not have permission to perform this action.',
            ErrorCode.WORKSPACE_ACCESS_DENIED
          )
        );
      }

      req.workspaceMember = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}
