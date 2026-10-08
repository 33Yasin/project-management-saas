import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
import { NotificationListQueryInput } from './notification.schemas';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.listUserNotifications(
        req.session.userId!,
        req.query as unknown as NotificationListQueryInput
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notificationId = getParam(req.params.notificationId);
      const notification = await notificationService.markAsRead({
        notificationId,
        userId: req.session.userId!,
      });
      res.status(200).json({ notification });
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.markAllAsRead(req.session.userId!);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
