import { Prisma, TaskStatus } from '@prisma/client';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskListQueryInput,
} from './tasks.schemas';
import { activityService } from '../activities/activity.service';
import { notificationService } from '../notifications/notification.service';

export class TasksService {
  async validateAssignee(workspaceId: string, assigneeId?: string | null): Promise<void> {
    if (!assigneeId) {
      return;
    }

    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: assigneeId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw AppError.badRequest(
        'Assignee must be a member of this workspace.',
        ErrorCode.INVALID_ASSIGNEE
      );
    }
  }

  async listProjectTasks(projectId: string, query: TaskListQueryInput) {
    const where: Prisma.TaskWhereInput = {
      projectId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const totalItems = await prisma.task.count({ where });
    const totalPages = Math.ceil(totalItems / query.limit);
    const skip = (query.page - 1) * query.limit;

    const items = await prisma.task.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: {
        [query.sort]: query.order,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { comments: true },
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

  async createTask(params: {
    projectId: string;
    workspaceId: string;
    createdById: string;
    input: CreateTaskInput;
  }) {
    const { projectId, workspaceId, createdById, input } = params;

    await this.validateAssignee(workspaceId, input.assigneeId);

    const maxPositionTask = await prisma.task.findFirst({
      where: { projectId, status: input.status },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = maxPositionTask ? maxPositionTask.position + 1 : 0;

    const task = await prisma.task.create({
      data: {
        projectId,
        createdById,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        position,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    await activityService.recordActivity({
      workspaceId,
      projectId,
      taskId: task.id,
      actorId: createdById,
      type: 'TASK_CREATED',
      metadata: {
        title: task.title,
        status: task.status,
        priority: task.priority,
      },
    });

    if (task.assigneeId && task.assigneeId !== createdById) {
      await notificationService.createNotification({
        userId: task.assigneeId,
        workspaceId,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        message: `You were assigned to task '${task.title}'`,
        entityType: 'TASK',
        entityId: task.id,
        actorId: createdById,
      });
    }

    return task;
  }

  async getTaskById(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, workspaceId: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    return task;
  }

  async updateTask(params: {
    taskId: string;
    workspaceId: string;
    actorId?: string;
    input: UpdateTaskInput;
  }) {
    const { taskId, workspaceId, actorId, input } = params;

    if (input.assigneeId) {
      await this.validateAssignee(workspaceId, input.assigneeId);
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        status: true,
        assigneeId: true,
        projectId: true,
      },
    });

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (existingTask) {
      if (input.status !== undefined && input.status !== existingTask.status) {
        await activityService.recordActivity({
          workspaceId,
          projectId: existingTask.projectId,
          taskId: task.id,
          actorId,
          type: 'TASK_STATUS_CHANGED',
          metadata: {
            from: existingTask.status,
            to: task.status,
          },
        });
      }

      if (input.assigneeId !== undefined && input.assigneeId !== existingTask.assigneeId) {
        await activityService.recordActivity({
          workspaceId,
          projectId: existingTask.projectId,
          taskId: task.id,
          actorId,
          type: 'TASK_ASSIGNEE_CHANGED',
          metadata: {
            from: existingTask.assigneeId,
            to: task.assigneeId,
            assigneeName: task.assignee?.name ?? null,
          },
        });

        if (input.assigneeId && input.assigneeId !== actorId) {
          await notificationService.createNotification({
            userId: input.assigneeId,
            workspaceId,
            type: 'TASK_ASSIGNED',
            title: 'Task Assigned',
            message: `You were assigned to task '${task.title}'`,
            entityType: 'TASK',
            entityId: task.id,
            actorId,
          });
        }
      }

      const hasOtherChanges =
        input.title !== undefined ||
        input.description !== undefined ||
        input.priority !== undefined ||
        input.dueDate !== undefined;

      if (hasOtherChanges) {
        const changedFields = Object.keys(input).filter(
          (k) => k !== 'status' && k !== 'assigneeId'
        );
        await activityService.recordActivity({
          workspaceId,
          projectId: existingTask.projectId,
          taskId: task.id,
          actorId,
          type: 'TASK_UPDATED',
          metadata: {
            fields: changedFields,
          },
        });
      }
    }

    return task;
  }

  async deleteTask(taskId: string, actorId?: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { workspaceId: true },
        },
      },
    });

    if (task) {
      await activityService.recordActivity({
        workspaceId: task.project.workspaceId,
        projectId: task.projectId,
        taskId: null,
        actorId,
        type: 'TASK_DELETED',
        metadata: {
          title: task.title,
        },
      });

      await prisma.task.delete({
        where: { id: taskId },
      });
    }
  }

  async moveTask(params: {
    taskId: string;
    targetIndex: number;
    newStatus?: TaskStatus;
    actorId?: string;
  }) {
    const { taskId, targetIndex, newStatus, actorId } = params;

    return await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          projectId: true,
          status: true,
          position: true,
          project: { select: { workspaceId: true } },
        },
      });

      if (!task) {
        throw AppError.notFound('Task not found.', ErrorCode.TASK_NOT_FOUND);
      }

      const currentStatus = task.status;
      const destinationStatus = newStatus || currentStatus;

      if (currentStatus === destinationStatus) {
        // Reordering within the same status column
        const columnTasks = await tx.task.findMany({
          where: {
            projectId: task.projectId,
            status: currentStatus,
            id: { not: taskId },
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, position: true },
        });

        const clampedIndex = Math.min(Math.max(0, targetIndex), columnTasks.length);
        const newOrder = [
          ...columnTasks.slice(0, clampedIndex),
          { id: taskId, position: task.position },
          ...columnTasks.slice(clampedIndex),
        ];

        for (let i = 0; i < newOrder.length; i++) {
          if (newOrder[i].position !== i || newOrder[i].id === taskId) {
            await tx.task.update({
              where: { id: newOrder[i].id },
              data: { position: i },
            });
          }
        }

        await activityService.recordActivity(
          {
            workspaceId: task.project.workspaceId,
            projectId: task.projectId,
            taskId,
            actorId,
            type: 'TASK_UPDATED',
            metadata: {
              reordered: true,
              position: targetIndex,
            },
          },
          tx
        );
      } else {
        // Moving across status columns
        const destTasks = await tx.task.findMany({
          where: {
            projectId: task.projectId,
            status: destinationStatus,
            id: { not: taskId },
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, position: true },
        });

        const clampedIndex = Math.min(Math.max(0, targetIndex), destTasks.length);
        const newDestOrder = [
          ...destTasks.slice(0, clampedIndex),
          { id: taskId, position: -1 },
          ...destTasks.slice(clampedIndex),
        ];

        for (let i = 0; i < newDestOrder.length; i++) {
          if (newDestOrder[i].id === taskId) {
            await tx.task.update({
              where: { id: taskId },
              data: { status: destinationStatus, position: i },
            });
          } else if (newDestOrder[i].position !== i) {
            await tx.task.update({
              where: { id: newDestOrder[i].id },
              data: { position: i },
            });
          }
        }

        // Normalize source column tasks
        const sourceTasks = await tx.task.findMany({
          where: {
            projectId: task.projectId,
            status: currentStatus,
            id: { not: taskId },
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, position: true },
        });

        for (let i = 0; i < sourceTasks.length; i++) {
          if (sourceTasks[i].position !== i) {
            await tx.task.update({
              where: { id: sourceTasks[i].id },
              data: { position: i },
            });
          }
        }

        await activityService.recordActivity(
          {
            workspaceId: task.project.workspaceId,
            projectId: task.projectId,
            taskId,
            actorId,
            type: 'TASK_STATUS_CHANGED',
            metadata: {
              from: currentStatus,
              to: destinationStatus,
              position: targetIndex,
            },
          },
          tx
        );
      }

      return await tx.task.findUnique({
        where: { id: taskId },
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { comments: true },
          },
        },
      });
    });
  }
}

export const tasksService = new TasksService();
