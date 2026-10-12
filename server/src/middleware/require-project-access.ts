import { Request, Response, NextFunction, RequestHandler } from 'express';
import { WorkspaceRole } from '@prisma/client';
import prisma from '../lib/db/prisma';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

async function handleProjectAccess(
  allowedRoles: WorkspaceRole[] | undefined,
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return next(
        AppError.unauthenticated('Authentication required.', ErrorCode.AUTH_REQUIRED)
      );
    }

    const rawProjectId = req.params.projectId;
    const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
    if (!projectId) {
      return next(
        AppError.badRequest('Project ID is required.', ErrorCode.VALIDATION_ERROR)
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return next(
        AppError.notFound('Project not found or access denied.', ErrorCode.PROJECT_NOT_FOUND)
      );
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: project.workspaceId,
        },
      },
    });

    if (!membership) {
      // Return 404 to avoid leaking existence of projects in private workspaces
      return next(
        AppError.notFound('Project not found or access denied.', ErrorCode.PROJECT_NOT_FOUND)
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

    // For regular MEMBER role, verify they belong to this project or have assigned tasks
    if (membership.role === 'MEMBER') {
      const isProjectMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!isProjectMember) {
        const hasAssignedTask = await prisma.task.findFirst({
          where: {
            projectId,
            assigneeId: userId,
          },
          select: { id: true },
        });

        if (!hasAssignedTask) {
          return next(
            AppError.notFound('Project not found or access denied.', ErrorCode.PROJECT_NOT_FOUND)
          );
        }
      }
    }

    req.project = project;
    req.workspaceMember = membership;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireProjectAccess(allowedRoles?: WorkspaceRole[]): RequestHandler;
export function requireProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void>;
export function requireProjectAccess(
  allowedRolesOrReq?: WorkspaceRole[] | Request,
  res?: Response,
  next?: NextFunction
): RequestHandler | Promise<void> {
  if (allowedRolesOrReq && 'session' in allowedRolesOrReq) {
    return handleProjectAccess(undefined, allowedRolesOrReq as Request, res!, next!);
  }

  const allowedRoles = allowedRolesOrReq as WorkspaceRole[] | undefined;
  return (req: Request, res: Response, next: NextFunction) =>
    handleProjectAccess(allowedRoles, req, res, next);
}
