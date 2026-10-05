import { z } from 'zod';

export const taskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE'], {
  message: "Status must be 'TODO', 'IN_PROGRESS', or 'DONE'",
});

export const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH'], {
  message: "Priority must be 'LOW', 'MEDIUM', or 'HIGH'",
});

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required')
    .max(200, 'Task title must be at most 200 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Task description must be at most 2000 characters')
    .optional()
    .nullable(),
  status: taskStatusEnum.default('TODO'),
  priority: taskPriorityEnum.default('MEDIUM'),
  assigneeId: z.string().trim().min(1).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title must be at least 1 character')
      .max(200, 'Task title must be at most 200 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, 'Task description must be at most 2000 characters')
      .optional()
      .nullable(),
    status: taskStatusEnum.optional(),
    priority: taskPriorityEnum.optional(),
    assigneeId: z.string().trim().min(1).optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.priority !== undefined ||
      data.assigneeId !== undefined ||
      data.dueDate !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  );

export const taskListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().trim().optional(),
  sort: z
    .enum(['createdAt', 'dueDate', 'priority', 'status', 'title'], {
      message:
        "Sort must be one of: 'createdAt', 'dueDate', 'priority', 'status', 'title'",
    })
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
});

export const taskIdParamSchema = z.object({
  taskId: z.string().trim().min(1, 'Task ID is required'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskListQueryInput = z.infer<typeof taskListQuerySchema>;
