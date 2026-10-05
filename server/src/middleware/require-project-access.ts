import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/db/prisma';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

export async function requireProjectAccess(
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

    req.project = project;
    req.workspaceMember = membership;
    next();
  } catch (error) {
    next(error);
  }
}
