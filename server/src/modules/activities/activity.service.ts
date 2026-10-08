import { ActivityType, Prisma } from '@prisma/client';
import prisma from '../../lib/db/prisma';
import { ActivityListQueryInput } from './activity.schemas';

export interface RecordActivityParams {
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId?: string | null;
  type: ActivityType;
  metadata?: Record<string, unknown> | null;
}

export class ActivityService {
  async recordActivity(
    params: RecordActivityParams,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return await db.activity.create({
      data: {
        workspaceId: params.workspaceId,
        projectId: params.projectId ?? null,
        taskId: params.taskId ?? null,
        actorId: params.actorId ?? null,
        type: params.type,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async listTaskActivities(taskId: string, query: ActivityListQueryInput) {
    const where: Prisma.ActivityWhereInput = {
      taskId,
    };

    const totalItems = await prisma.activity.count({ where });
    const totalPages = Math.ceil(totalItems / query.limit);
    const skip = (query.page - 1) * query.limit;

    const items = await prisma.activity.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
      },
    };
  }
}

export const activityService = new ActivityService();
