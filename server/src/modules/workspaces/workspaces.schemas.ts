import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(50, 'Workspace name must be at most 50 characters'),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(50, 'Workspace name must be at most 50 characters'),
});

export const transferOwnershipSchema = z.object({
  targetUserId: z
    .string()
    .trim()
    .min(1, 'Target user ID is required'),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
