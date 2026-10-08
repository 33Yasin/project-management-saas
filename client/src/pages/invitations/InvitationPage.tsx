import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api/api-fetch';
import type { InvitationPreview, WorkspaceMember } from '@/types/api';
import { useAuth } from '@/features/auth/use-auth';
import { Button, buttonVariants } from '@/components/ui/button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, UserCheck, AlertTriangle } from 'lucide-react';

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const {
    data: invitation,
    isLoading: isInviteLoading,
    error: inviteError,
  } = useQuery<InvitationPreview>({
    queryKey: ['invitation', 'preview', token],
    queryFn: async () => {
      const res = await apiFetch<{ invitation: InvitationPreview }>(
        `/api/invitations/${token}/preview`
      );
      return res.invitation;
    },
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ message: string; member: WorkspaceMember }>(
        `/api/invitations/${token}/accept`,
        { method: 'POST' }
      );
      return res.member;
    },
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      navigate(`/workspaces/${member.workspaceId}`, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setAcceptError(err.message);
      } else {
        setAcceptError('Failed to accept invitation. Please try again.');
      }
    },
  });

  if (isInviteLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <p className="text-muted-foreground text-sm">Loading invitation details...</p>
      </div>
    );
  }

  if (inviteError || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md shadow-md border-border/80 text-center p-6">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="size-6" />
          </div>
          <CardTitle className="text-xl mb-2">Invalid or Expired Invitation</CardTitle>
          <CardDescription className="mb-6">
            This invitation link is invalid, has expired, or has already been accepted.
          </CardDescription>
          <Link
            to="/workspaces"
            className={cn(buttonVariants({ variant: 'default' }), 'w-full cursor-pointer')}
          >
            Go to Workspaces
          </Link>
        </Card>
      </div>
    );
  }

  const isEmailMatch =
    user && user.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-md border-border/80">
        <CardHeader className="text-center">
          <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Building2 className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold">You've been invited!</CardTitle>
          <CardDescription>
            Join <span className="font-semibold text-foreground">{invitation.workspace.name}</span> on Agora
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptError && (
            <div className="p-3 text-sm rounded-md bg-destructive/15 text-destructive border border-destructive/20">
              {acceptError}
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="size-4" /> Invited by:
              </span>
              <span className="font-medium text-foreground">{invitation.invitedBy.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-4" /> Sent to:
              </span>
              <span className="font-medium text-foreground">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Role:</span>
              <Badge variant="secondary">{invitation.role}</Badge>
            </div>
          </div>

          {isAuthenticated && !isEmailMatch && (
            <div className="p-3 text-xs rounded-md bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
              You are currently signed in as <strong>{user?.email}</strong>. This invitation was sent to <strong>{invitation.email}</strong>. Please switch accounts to accept this invitation.
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          {isAuthenticated ? (
            isEmailMatch ? (
              <Button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="w-full cursor-pointer"
              >
                {acceptMutation.isPending ? 'Joining Workspace...' : 'Accept & Join Workspace'}
              </Button>
            ) : (
              <Link
                to="/login"
                state={{ from: { pathname: `/invitations/${token}` } }}
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full cursor-pointer')}
              >
                Sign in with {invitation.email}
              </Link>
            )
          ) : (
            <div className="w-full space-y-2">
              <Link
                to="/login"
                state={{ from: { pathname: `/invitations/${token}` } }}
                className={cn(buttonVariants({ variant: 'default' }), 'w-full cursor-pointer')}
              >
                Sign in to Accept
              </Link>
              <Link
                to="/register"
                state={{ from: { pathname: `/invitations/${token}` } }}
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full cursor-pointer')}
              >
                Create Account
              </Link>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
