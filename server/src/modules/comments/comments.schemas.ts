import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment content cannot exceed 2000 characters'),
});

export const commentIdParamSchema = z.object({
  commentId: z.string().trim().min(1, 'Comment ID is required'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
