import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import { CreateCommentInput } from './comments.schemas';

export class CommentsService {
  async listComments(taskId: string) {
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  async createComment(params: {
    taskId: string;
    authorId: string;
    input: CreateCommentInput;
  }) {
    const comment = await prisma.comment.create({
      data: {
        taskId: params.taskId,
        authorId: params.authorId,
        content: params.input.content,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return comment;
  }

  async deleteComment(params: { commentId: string; userId: string }) {
    const { commentId, userId } = params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          select: {
            project: {
              select: {
                workspaceId: true,
              },
            },
          },
        },
      },
    });

    if (!comment) {
      throw AppError.notFound('Comment not found or access denied.', ErrorCode.COMMENT_NOT_FOUND);
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: comment.task.project.workspaceId,
        },
      },
    });

    if (!membership) {
      // Return 404 to avoid leaking existence of private comments
      throw AppError.notFound('Comment not found or access denied.', ErrorCode.COMMENT_NOT_FOUND);
    }

    const isAuthor = comment.authorId === userId;
    const canDeleteOthers =
      membership.role === 'OWNER' || membership.role === 'ADMIN';

    if (!isAuthor && !canDeleteOthers) {
      throw AppError.unauthorized(
        'You do not have permission to delete this comment.',
        ErrorCode.WORKSPACE_ACCESS_DENIED
      );
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });
  }
}

export const commentsService = new CommentsService();
