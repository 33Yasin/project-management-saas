import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Notification, NotificationsResponse } from '@/types/api';

export interface UseNotificationsOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const queryClient = useQueryClient();
  const { page = 1, limit = 20, unreadOnly = false } = options;

  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  queryParams.set('limit', limit.toString());
  if (unreadOnly) {
    queryParams.set('unreadOnly', 'true');
  }

  const endpoint = `/api/notifications?${queryParams.toString()}`;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', { page, limit, unreadOnly }],
    queryFn: async () => {
      return await apiFetch<NotificationsResponse>(endpoint);
    },
    // Poll every 30 seconds for background notifications
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiFetch<{ notification: Notification }>(
        `/api/notifications/${notificationId}/read`,
        { method: 'PATCH' }
      );
      return res.notification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ count: number }>(
        '/api/notifications/read-all',
        { method: 'POST' }
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: data?.items ?? [],
    unreadCount: data?.unreadCount ?? 0,
    pagination: data?.pagination,
    isLoading,
    isError,
    error,
    refetch,
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingRead: markAsReadMutation.isPending,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAllRead: markAllAsReadMutation.isPending,
  };
}
