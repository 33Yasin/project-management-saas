import { Request, Response, NextFunction } from 'express';
import { attachmentService } from './attachment.service';

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export class AttachmentController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const attachments = await attachmentService.listTaskAttachments(taskId);
      res.status(200).json({ attachments });
    } catch (error) {
      next(error);
    }
  }

  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = getParam(req.params.taskId);
      const task = req.task!;
      const file = req.file;

      const attachment = await attachmentService.uploadAttachment({
        taskId,
        uploadedById: req.session.userId!,
        workspaceId: task.project.workspaceId,
        projectId: task.projectId,
        file: file
          ? {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              buffer: file.buffer,
            }
          : undefined,
      });

      res.status(201).json({ attachment });
    } catch (error) {
      next(error);
    }
  }

  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attachmentId = getParam(req.params.attachmentId);
      const { attachment, buffer } = await attachmentService.getAttachmentForDownload({
        attachmentId,
        userId: req.session.userId!,
      });

      const safeAsciiName = attachment.originalName.replace(/[^\x20-\x7E]/g, '_');
      const encodedName = encodeURIComponent(attachment.originalName);

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`
      );
      res.setHeader('Content-Length', buffer.length.toString());

      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attachmentId = getParam(req.params.attachmentId);
      await attachmentService.deleteAttachment({
        attachmentId,
        userId: req.session.userId!,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const attachmentController = new AttachmentController();
