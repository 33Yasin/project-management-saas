import { Prisma } from '@prisma/client';
import prisma from '../../lib/db/prisma';
import { AppError } from '../../errors/app-error';
import { ErrorCode } from '../../errors/error-codes';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskListQueryInput,
} from './tasks.schemas';

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

    const task = await prisma.task.create({
      data: {
        projectId,
        createdById,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
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
    input: UpdateTaskInput;
  }) {
    const { taskId, workspaceId, input } = params;

    if (input.assigneeId) {
      await this.validateAssignee(workspaceId, input.assigneeId);
    }

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

    return task;
  }

  async deleteTask(taskId: string) {
    await prisma.task.delete({
      where: { id: taskId },
    });
  }
}

export const tasksService = new TasksService();
