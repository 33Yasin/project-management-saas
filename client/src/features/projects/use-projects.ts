import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Project } from '@/types/api';

export function useProjects(workspaceId?: string) {
  const queryClient = useQueryClient();

  const {
    data: projects = [],
    isLoading,
    isError,
    error,
  } = useQuery<Project[]>({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ projects: Project[] }>(
        `/api/workspaces/${workspaceId}/projects`
      );
      return res.projects;
    },
    enabled: !!workspaceId,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; memberIds?: string[] }) => {
      const res = await apiFetch<{ project: Project }>(
        `/api/workspaces/${workspaceId}/projects`,
        {
          method: 'POST',
          body: data,
        }
      );
      return res.project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
  });

  return {
    projects,
    isLoading,
    isError,
    error,
    createProject: createProjectMutation.mutateAsync,
    isCreating: createProjectMutation.isPending,
  };
}

export function useProject(projectId?: string) {
  const queryClient = useQueryClient();

  const {
    data: project,
    isLoading,
    isError,
    error,
  } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await apiFetch<{ project: Project }>(`/api/projects/${projectId}`);
      return res.project;
    },
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      description?: string | null;
      memberIds?: string[];
    }) => {
      const res = await apiFetch<{ project: Project }>(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: data,
      });
      return res.project;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['project', projectId], updated);
      queryClient.invalidateQueries({ queryKey: ['projects', updated.workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      if (project) {
        queryClient.invalidateQueries({ queryKey: ['projects', project.workspaceId] });
      }
    },
  });

  return {
    project,
    isLoading,
    isError,
    error,
    updateProject: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteProject: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

export function useProjectMembers(projectId?: string) {
  const queryClient = useQueryClient();

  const {
    data: members = [],
    isLoading,
    isError,
    error,
  } = useQuery<import('@/types/api').ProjectMember[]>({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const res = await apiFetch<{ members: import('@/types/api').ProjectMember[] }>(
        `/api/projects/${projectId}/members`
      );
      return res.members;
    },
    enabled: !!projectId,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiFetch<{ member: import('@/types/api').ProjectMember }>(
        `/api/projects/${projectId}/members`,
        {
          method: 'POST',
          body: { userId },
        }
      );
      return res.member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiFetch(`/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    members,
    isLoading,
    isError,
    error,
    addMember: addMemberMutation.mutateAsync,
    isAdding: addMemberMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemoving: removeMemberMutation.isPending,
  };
}
