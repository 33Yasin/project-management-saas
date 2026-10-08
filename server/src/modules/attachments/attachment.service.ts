import crypto from 'crypto';
import prisma from '../../lib/db/prisma';
import { storageService } from '../../lib/storage/storage.service';
import { activityService } from '../activities/activity.service';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  sanitizeFilename,
} from './attachment.constants';

export interface UploadAttachmentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class AttachmentService {
  async listTaskAttachments(taskId: string) {
    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return attachments;
  }

  async uploadAttachment(params: {
    taskId: string;
    uploadedById: string;
    workspaceId: string;
    projectId: string;
    file?: UploadAttachmentFile;
  }) {
    const { taskId, uploadedById, workspaceId, projectId, file } = params;

    if (!file || !file.buffer) {
      throw AppError.badRequest('No file provided.', ErrorCode.VALIDATION_ERROR);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw AppError.badRequest(
        `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        ErrorCode.VALIDATION_ERROR
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw AppError.badRequest(
        `File type '${file.mimetype}' is not permitted.`,
        ErrorCode.VALIDATION_ERROR
      );
    }

    const safeFilename = sanitizeFilename(file.originalname);
    const storageKey = `${crypto.randomUUID()}-${Date.now()}`;

    // 1. Save binary file to storage adapter
    await storageService.save(storageKey, file.buffer, file.mimetype);

    // 2. Save metadata to DB with rollback on failure
    try {
      const attachment = await prisma.attachment.create({
        data: {
          taskId,
          uploadedById,
          originalName: safeFilename,
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // 3. Record audit activity
      await activityService.recordActivity({
        workspaceId,
        projectId,
        taskId,
        actorId: uploadedById,
        type: 'ATTACHMENT_ADDED',
        metadata: {
          attachmentId: attachment.id,
          originalName: attachment.originalName,
          sizeBytes: attachment.sizeBytes,
        },
      });

      return attachment;
    } catch (dbError) {
      // Rollback file in storage if DB insert fails
      await storageService.delete(storageKey).catch(() => {});
      throw dbError;
    }
  }

  async getAttachmentForDownload(params: { attachmentId: string; userId: string }) {
    const { attachmentId, userId } = params;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: {
          select: {
            id: true,
            project: {
              select: {
                workspaceId: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw AppError.notFound('Attachment not found or access denied.', ErrorCode.ATTACHMENT_NOT_FOUND);
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: attachment.task.project.workspaceId,
        },
      },
    });

    if (!membership) {
      throw AppError.notFound('Attachment not found or access denied.', ErrorCode.ATTACHMENT_NOT_FOUND);
    }

    const file = await storageService.get(attachment.storageKey);
    if (!file) {
      throw AppError.notFound('Attachment file not found in storage.', ErrorCode.ATTACHMENT_NOT_FOUND);
    }

    return {
      attachment,
      buffer: file.buffer,
    };
  }

  async deleteAttachment(params: { attachmentId: string; userId: string }) {
    const { attachmentId, userId } = params;

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: {
          select: {
            id: true,
            projectId: true,
            project: {
              select: {
                workspaceId: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw AppError.notFound('Attachment not found or access denied.', ErrorCode.ATTACHMENT_NOT_FOUND);
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: attachment.task.project.workspaceId,
        },
      },
    });

    if (!membership) {
      throw AppError.notFound('Attachment not found or access denied.', ErrorCode.ATTACHMENT_NOT_FOUND);
    }

    const isUploader = attachment.uploadedById === userId;
    const canDeleteOthers = membership.role === 'OWNER' || membership.role === 'ADMIN';

    if (!isUploader && !canDeleteOthers) {
      throw AppError.unauthorized(
        'You do not have permission to delete this attachment.',
        ErrorCode.WORKSPACE_ACCESS_DENIED
      );
    }

    // 1. Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // 2. Delete from storage adapter
    await storageService.delete(attachment.storageKey);

    // 3. Record audit activity
    await activityService.recordActivity({
      workspaceId: attachment.task.project.workspaceId,
      projectId: attachment.task.projectId,
      taskId: attachment.task.id,
      actorId: userId,
      type: 'ATTACHMENT_DELETED',
      metadata: {
        originalName: attachment.originalName,
      },
    });
  }
}

export const attachmentService = new AttachmentService();
