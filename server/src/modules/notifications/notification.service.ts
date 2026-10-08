import { NotificationType, Prisma } from '@prisma/client';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import { NotificationListQueryInput } from './notification.schemas';

export interface CreateNotificationParams {
  userId: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
}

export class NotificationService {
  async createNotification(
    params: CreateNotificationParams,
    tx?: Prisma.TransactionClient
  ) {
    // Suppress notification if actor triggers an event on themselves
    if (params.actorId && params.actorId === params.userId) {
      return null;
    }

    const db = tx || prisma;
    return await db.notification.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      },
    });
  }

  async listUserNotifications(userId: string, query: NotificationListQueryInput) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly && { readAt: null }),
    };

    const [totalItems, unreadCount, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.notification.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / query.limit);

    return {
      items,
      unreadCount,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
      },
    };
  }

  async markAsRead(params: { notificationId: string; userId: string }) {
    const { notificationId, userId } = params;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw AppError.notFound('Notification not found.', ErrorCode.NOTIFICATION_NOT_FOUND);
    }

    return await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }
}

export const notificationService = new NotificationService();
