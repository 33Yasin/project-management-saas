import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireTaskAccess } from '../../middleware/require-task-access';
import { validate } from '../../middleware/validate';
import { taskIdParamSchema } from '../tasks/tasks.schemas';
import { activityListQuerySchema } from './activity.schemas';
import { activityController } from './activity.controller';

export const taskActivitiesRouter = Router({ mergeParams: true });

taskActivitiesRouter.use(requireAuth);
taskActivitiesRouter.use(validate({ params: taskIdParamSchema }));
taskActivitiesRouter.use(requireTaskAccess);

taskActivitiesRouter.get(
  '/',
  validate({ query: activityListQuerySchema }),
  (req, res, next) => {
    activityController.listTaskActivities(req, res, next);
  }
);

export default taskActivitiesRouter;
