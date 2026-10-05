import { Request, Response, NextFunction } from 'express';
import { commentsService } from './comments.service';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class CommentsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const comments = await commentsService.listComments(taskId);
      res.status(200).json({ comments });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const comment = await commentsService.createComment({
        taskId,
        authorId: req.session.userId!,
        input: req.body,
      });
      res.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const commentId = getParam(req.params.commentId);
      await commentsService.deleteComment({
        commentId,
        userId: req.session.userId!,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const commentsController = new CommentsController();
