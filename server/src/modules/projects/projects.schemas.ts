import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .max(100, 'Project name must be at most 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .nullable(),
  memberIds: z.array(z.string().trim().min(1)).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Project name must be at least 2 characters')
      .max(100, 'Project name must be at most 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be at most 500 characters')
      .optional()
      .nullable(),
    memberIds: z.array(z.string().trim().min(1)).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.memberIds !== undefined,
    {
      message:
        'At least one field (name, description, or memberIds) must be provided for update',
    }
  );

export const projectIdParamSchema = z.object({
  projectId: z.string().trim().min(1, 'Project ID is required'),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().trim().min(1, 'User ID is required'),
});

export const projectMemberParamSchema = z.object({
  projectId: z.string().trim().min(1, 'Project ID is required'),
  userId: z.string().trim().min(1, 'User ID is required'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
