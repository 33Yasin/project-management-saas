import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Activity, PaginatedResponse } from '@/types/api';

export function useTaskActivities(taskId?: string, page = 1, limit = 20) {
  const endpoint = `/api/tasks/${taskId}/activities?page=${page}&limit=${limit}`;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PaginatedResponse<Activity>>({
    queryKey: ['task-activities', taskId, page, limit],
    queryFn: async () => {
      const res = await apiFetch<PaginatedResponse<Activity>>(endpoint);
      return res;
    },
    enabled: !!taskId,
  });

  return {
    activities: data?.items ?? [],
    pagination: data?.pagination,
    isLoading,
    isError,
    error,
    refetch,
  };
}
