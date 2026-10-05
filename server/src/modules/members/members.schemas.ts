import { z } from 'zod';

export const memberIdParamSchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  memberId: z.string().trim().min(1, 'Member ID is required'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER'], {
    message: "Role must be either 'ADMIN' or 'MEMBER'",
  }),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
