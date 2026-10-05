import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/db/prisma';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

export async function requireTaskAccess(
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

    const rawTaskId = req.params.taskId;
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
    if (!taskId) {
      return next(
        AppError.badRequest('Task ID is required.', ErrorCode.VALIDATION_ERROR)
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    if (!task) {
      return next(
        AppError.notFound('Task not found or access denied.', ErrorCode.TASK_NOT_FOUND)
      );
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: task.project.workspaceId,
        },
      },
    });

    if (!membership) {
      // Return 404 to avoid leaking existence of private tasks
      return next(
        AppError.notFound('Task not found or access denied.', ErrorCode.TASK_NOT_FOUND)
      );
    }

    req.task = task;
    req.workspaceMember = membership;
    next();
  } catch (error) {
    next(error);
  }
}
