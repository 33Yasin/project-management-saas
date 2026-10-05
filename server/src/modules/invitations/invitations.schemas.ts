import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  role: z.enum(['ADMIN', 'MEMBER'], {
    message: "Role must be either 'ADMIN' or 'MEMBER'",
  }),
});

export const invitationIdParamSchema = z.object({
  workspaceId: z.string().trim().min(1, 'Workspace ID is required'),
  invitationId: z.string().trim().min(1, 'Invitation ID is required'),
});

export const tokenParamSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
