import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import type { Workspace, WorkspaceMember, Invitation } from '@/types/api';

export function useWorkspaces() {
  const queryClient = useQueryClient();

  const {
    data: workspaces = [],
    isLoading,
    isError,
    error,
  } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
      return res.workspaces;
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiFetch<{ workspace: Workspace }>('/api/workspaces', {
        method: 'POST',
        body: data,
      });
      return res.workspace;
    },
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      return newWorkspace;
    },
  });

  return {
    workspaces,
    isLoading,
    isError,
    error,
    createWorkspace: createWorkspaceMutation.mutateAsync,
    isCreating: createWorkspaceMutation.isPending,
  };
}

export function useWorkspace(workspaceId?: string) {
  const queryClient = useQueryClient();

  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useQuery<Workspace>({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`);
      return res.workspace;
    },
    enabled: !!workspaceId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiFetch<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: data,
      });
      return res.workspace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async (data: { targetUserId: string }) => {
      await apiFetch(`/api/workspaces/${workspaceId}/transfer-ownership`, {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  return {
    workspace,
    isLoading,
    isError,
    error,
    updateWorkspace: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteWorkspace: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    transferOwnership: transferOwnershipMutation.mutateAsync,
    isTransferring: transferOwnershipMutation.isPending,
  };
}

export function useWorkspaceMembers(workspaceId?: string) {
  const queryClient = useQueryClient();

  const {
    data: members = [],
    isLoading,
    isError,
    error,
  } = useQuery<WorkspaceMember[]>({
    queryKey: ['members', workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ members: WorkspaceMember[] }>(
        `/api/workspaces/${workspaceId}/members`
      );
      return res.members;
    },
    enabled: !!workspaceId,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'ADMIN' | 'MEMBER' }) => {
      const res = await apiFetch<{ member: WorkspaceMember }>(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'PATCH',
          body: { role },
        }
      );
      return res.member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
    },
  });

  return {
    members,
    isLoading,
    isError,
    error,
    updateRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemovingMember: removeMemberMutation.isPending,
  };
}

export function useWorkspaceInvitations(workspaceId?: string) {
  const queryClient = useQueryClient();

  const {
    data: invitations = [],
    isLoading,
    isError,
    error,
  } = useQuery<Invitation[]>({
    queryKey: ['invitations', workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ invitations: Invitation[] }>(
        `/api/workspaces/${workspaceId}/invitations`
      );
      return res.invitations;
    },
    enabled: !!workspaceId,
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; role: 'ADMIN' | 'MEMBER' }) => {
      const res = await apiFetch<{ invitation: Invitation }>(
        `/api/workspaces/${workspaceId}/invitations`,
        {
          method: 'POST',
          body: data,
        }
      );
      return res.invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await apiFetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] });
    },
  });

  return {
    invitations,
    isLoading,
    isError,
    error,
    createInvitation: createInvitationMutation.mutateAsync,
    isCreatingInvitation: createInvitationMutation.isPending,
    revokeInvitation: revokeInvitationMutation.mutateAsync,
    isRevokingInvitation: revokeInvitationMutation.isPending,
  };
}
