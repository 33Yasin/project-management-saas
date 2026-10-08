import { Request, Response, NextFunction } from 'express';
import { activityService } from './activity.service';
import { ActivityListQueryInput } from './activity.schemas';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class ActivityController {
  async listTaskActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const result = await activityService.listTaskActivities(
        taskId,
        req.query as unknown as ActivityListQueryInput
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
