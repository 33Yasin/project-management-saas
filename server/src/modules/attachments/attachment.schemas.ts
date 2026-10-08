import { z } from 'zod';

export const attachmentIdParamSchema = z.object({
  attachmentId: z.string().uuid('Invalid attachment ID format'),
});

export type AttachmentIdParamInput = z.infer<typeof attachmentIdParamSchema>;
