import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Task, Comment, PaginatedResponse, TaskStatus, TaskPriority } from '@/types/api';

export interface TaskFilters {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export function useProjectTasks(projectId?: string, filters: TaskFilters = {}) {
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.priority) queryParams.set('priority', filters.priority);
  if (filters.assigneeId) queryParams.set('assigneeId', filters.assigneeId);
  if (filters.sort) queryParams.set('sort', filters.sort);
  if (filters.order) queryParams.set('order', filters.order);
  if (filters.page) queryParams.set('page', filters.page.toString());
  if (filters.limit) queryParams.set('limit', filters.limit.toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/projects/${projectId}/tasks${queryString ? `?${queryString}` : ''}`;

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<PaginatedResponse<Task>>({
    queryKey: ['tasks', projectId, filters],
    queryFn: async () => {
      const res = await apiFetch<PaginatedResponse<Task>>(endpoint);
      return res;
    },
    enabled: !!projectId,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
      dueDate?: string | null;
    }) => {
      const res = await apiFetch<{ task: Task }>(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: input,
      });
      return res.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    tasks: data?.items || [],
    pagination: data?.pagination || { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    isLoading,
    isError,
    error,
    createTask: createTaskMutation.mutateAsync,
    isCreating: createTaskMutation.isPending,
  };
}

export function useTask(taskId?: string) {
  const queryClient = useQueryClient();

  const {
    data: task,
    isLoading,
    isError,
    error,
  } = useQuery<Task>({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await apiFetch<{ task: Task }>(`/api/tasks/${taskId}`);
      return res.task;
    },
    enabled: !!taskId,
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
      dueDate?: string | null;
    }) => {
      const res = await apiFetch<{ task: Task }>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: input,
      });
      return res.task;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['task', taskId], updated);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    task,
    isLoading,
    isError,
    error,
    updateTask: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTask: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

export function useTaskComments(taskId?: string) {
  const queryClient = useQueryClient();

  const {
    data: comments = [],
    isLoading,
    isError,
    error,
  } = useQuery<Comment[]>({
    queryKey: ['comments', taskId],
    queryFn: async () => {
      const res = await apiFetch<{ comments: Comment[] }>(`/api/tasks/${taskId}/comments`);
      return res.comments;
    },
    enabled: !!taskId,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiFetch<{ comment: Comment }>(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: { content },
      });
      return res.comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiFetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return {
    comments,
    isLoading,
    isError,
    error,
    createComment: createCommentMutation.mutateAsync,
    isCreating: createCommentMutation.isPending,
    deleteComment: deleteCommentMutation.mutateAsync,
    isDeleting: deleteCommentMutation.isPending,
  };
}
