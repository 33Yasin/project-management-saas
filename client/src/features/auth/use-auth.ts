import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api/api-fetch';
import type { User } from '@/types/api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface UseAuthOptions {
  enabled?: boolean;
}

export function useAuth(options?: UseAuthOptions) {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await apiFetch<{ user: User }>('/api/auth/me');
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return null;
        }
        throw err;
      }
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiFetch<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: credentials,
      });
      return res.user;
    },
    onSuccess: (newUser) => {
      queryClient.setQueryData(['auth', 'me'], newUser);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterCredentials) => {
      const res = await apiFetch<{ user: User }>('/api/auth/register', {
        method: 'POST',
        body: data,
      });
      return res.user;
    },
    onSuccess: (newUser) => {
      queryClient.setQueryData(['auth', 'me'], newUser);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isError,
    error,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refetchUser: refetch,
  };
}
