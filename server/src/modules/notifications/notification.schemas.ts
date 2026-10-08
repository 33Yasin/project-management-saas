import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export type NotificationListQueryInput = z.infer<typeof notificationListQuerySchema>;

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID format'),
});

export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>;
