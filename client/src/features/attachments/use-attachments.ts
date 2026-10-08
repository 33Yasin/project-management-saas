import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Attachment } from '@/types/api';

export function useTaskAttachments(taskId?: string) {
  const queryClient = useQueryClient();

  const {
    data: attachments = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Attachment[]>({
    queryKey: ['task-attachments', taskId],
    queryFn: async () => {
      const res = await apiFetch<{ attachments: Attachment[] }>(
        `/api/tasks/${taskId}/attachments`
      );
      return res.attachments;
    },
    enabled: !!taskId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch<{ attachment: Attachment }>(
        `/api/tasks/${taskId}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      );
      return res.attachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-activities', taskId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiFetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-activities', taskId] });
    },
  });

  return {
    attachments,
    isLoading,
    isError,
    error,
    refetch,
    uploadAttachment: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    deleteAttachment: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
