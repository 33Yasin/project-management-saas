import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/require-auth';
import { requireTaskAccess } from '../../middleware/require-task-access';
import { validate } from '../../middleware/validate';
import { taskIdParamSchema } from '../tasks/tasks.schemas';
import { attachmentIdParamSchema } from './attachment.schemas';
import { attachmentController } from './attachment.controller';
import { MAX_FILE_SIZE_BYTES } from './attachment.constants';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

function handleMulterUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(
          AppError.badRequest(
            `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
            ErrorCode.VALIDATION_ERROR
          )
        );
      }
      return next(
        AppError.badRequest(
          err instanceof Error ? err.message : 'File upload failed.',
          ErrorCode.VALIDATION_ERROR
        )
      );
    }
    next();
  });
}

// Router mounted on /api/tasks/:taskId/attachments
export const taskAttachmentsRouter = Router({ mergeParams: true });

taskAttachmentsRouter.use(requireAuth);
taskAttachmentsRouter.use(validate({ params: taskIdParamSchema }));
taskAttachmentsRouter.use(requireTaskAccess);

taskAttachmentsRouter.get('/', (req, res, next) => {
  attachmentController.list(req, res, next);
});

taskAttachmentsRouter.post('/', handleMulterUpload, (req, res, next) => {
  attachmentController.upload(req, res, next);
});

// Router mounted on /api/attachments
export const attachmentsRouter = Router();

attachmentsRouter.use(requireAuth);

attachmentsRouter.get(
  '/:attachmentId/download',
  validate({ params: attachmentIdParamSchema }),
  (req, res, next) => {
    attachmentController.download(req, res, next);
  }
);

attachmentsRouter.delete(
  '/:attachmentId',
  validate({ params: attachmentIdParamSchema }),
  (req, res, next) => {
    attachmentController.delete(req, res, next);
  }
);

export default attachmentsRouter;
