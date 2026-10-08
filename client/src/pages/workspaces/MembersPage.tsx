import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import {
  useWorkspace,
  useWorkspaceMembers,
  useWorkspaceInvitations,
} from '@/features/workspaces/use-workspaces';
import { useLanguage } from '@/lib/i18n/language-context';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  UserPlus,
  Mail,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { WorkspaceMember } from '@/types/api';

export default function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const { workspace } = useWorkspace(workspaceId);
  const { t } = useLanguage();
  const {
    members,
    isLoading: isMembersLoading,
    updateRole,
    removeMember,
    isRemovingMember,
  } = useWorkspaceMembers(workspaceId);
  const {
    invitations,
    createInvitation,
    revokeInvitation,
    isCreatingInvitation,
  } = useWorkspaceInvitations(workspaceId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const canManageMembers =
    workspace?.role === 'OWNER' || workspace?.role === 'ADMIN';

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviteError(null);
      const res = await createInvitation({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (res.token) {
        const link = `${window.location.origin}/invitations/${res.token}`;
        setCreatedInviteLink(link);
      }
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to create invitation');
    }
  };

  const handleCopyLink = () => {
    if (createdInviteLink) {
      navigator.clipboard.writeText(createdInviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('members.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('members.subtitle', { workspace: workspace?.name || '' })}
          </p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setInviteOpen(true)} className="cursor-pointer">
            <UserPlus className="size-4 mr-1.5" />
            {t('members.inviteMember')}
          </Button>
        )}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('members.activeMembers', { count: members.length })}
          </CardTitle>
          <CardDescription>
            {t('members.activeMembersDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMembersLoading ? (
            <p className="text-sm text-muted-foreground py-4">{t('members.loadingMembers')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3">{t('members.member')}</th>
                    <th className="px-4 py-3">{t('members.email')}</th>
                    <th className="px-4 py-3">{t('members.role')}</th>
                    <th className="px-4 py-3">{t('members.joined')}</th>
                    {canManageMembers && <th className="px-4 py-3 text-right">{t('members.actions')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => {
                    const isSelf = m.userId === user?.id;
                    const isOwner = m.role === 'OWNER';
                    const canEditThisMember =
                      canManageMembers && !isOwner && !isSelf;

                    return (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-foreground">
                          {m.user.name} {isSelf && <span className="text-xs text-muted-foreground">{t('members.you')}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{m.user.email}</td>
                        <td className="px-4 py-3.5">
                          {canEditThisMember ? (
                            <Select
                              value={m.role}
                              onChange={(e) =>
                                updateRole({
                                  memberId: m.id,
                                  role: e.target.value as 'ADMIN' | 'MEMBER',
                                })
                              }
                              className="h-8 w-28 text-xs"
                            >
                              <option value="MEMBER">MEMBER</option>
                              <option value="ADMIN">ADMIN</option>
                            </Select>
                          ) : (
                            <Badge
                              variant={
                                m.role === 'OWNER'
                                  ? 'default'
                                  : m.role === 'ADMIN'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {m.role}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>
                        {canManageMembers && (
                          <td className="px-4 py-3.5 text-right">
                            {canEditThisMember && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRemoveError(null);
                                  setMemberToRemove(m);
                                }}
                                title={t('members.removeMemberBtn')}
                                aria-label={`${t('members.removeMemberBtn')} ${m.user.name}`}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations Table (For Admin & Owner) */}
      {canManageMembers && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('members.pendingInvitations', { count: invitations.length })}
            </CardTitle>
            <CardDescription>
              {t('members.pendingInvitationsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3">{t('members.email')}</th>
                    <th className="px-4 py-3">{t('members.role')}</th>
                    <th className="px-4 py-3">{t('members.invitedBy')}</th>
                    <th className="px-4 py-3">{t('members.expires')}</th>
                    <th className="px-4 py-3 text-right">{t('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-foreground flex items-center gap-1.5">
                        <Mail className="size-3.5 text-muted-foreground" />
                        {inv.email}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant="secondary">{inv.role}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {inv.invitedBy?.name || t('members.workspaceAdmin')}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('members.revokeConfirm', { email: inv.email }))) {
                              revokeInvitation(inv.id);
                            }
                          }}
                          title={t('members.revoke')}
                          aria-label={`${t('members.revoke')} ${inv.email}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-xs"
                        >
                          {t('members.revoke')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Member Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setCreatedInviteLink(null);
            setInviteError(null);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('members.inviteNewMemberTitle')}</DialogTitle>
          <DialogDescription>
            {t('members.inviteNewMemberDesc', { workspace: workspace?.name || '' })}
          </DialogDescription>
        </DialogHeader>

        {createdInviteLink ? (
          <div className="space-y-4 py-3">
            <div className="p-3 text-sm rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800">
              <p className="font-semibold mb-1">{t('members.inviteCreated')}</p>
              <p className="text-xs">
                {t('members.inviteCreatedNote')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input value={createdInviteLink} readOnly className="text-xs font-mono" />
              <Button onClick={handleCopyLink} size="sm" variant="outline" className="cursor-pointer shrink-0">
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                <span className="ml-1">{copied ? t('common.copied') : t('common.copy')}</span>
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setInviteOpen(false)} className="w-full cursor-pointer">
                {t('common.done')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleCreateInvite}>
            <div className="space-y-4 py-2">
              {inviteError && (
                <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                  {inviteError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="invEmail">{t('members.emailAddress')}</Label>
                <Input
                  id="invEmail"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isCreatingInvitation}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invRole">{t('members.role')}</Label>
                <Select
                  id="invRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                  disabled={isCreatingInvitation}
                >
                  <option value="MEMBER">{t('members.roleMemberDesc')}</option>
                  <option value="ADMIN">{t('members.roleAdminDesc')}</option>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={isCreatingInvitation}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isCreatingInvitation || !inviteEmail.trim()}>
                {isCreatingInvitation ? t('members.generatingLink') : t('members.createInvitationBtn')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToRemove(null);
            setRemoveError(null);
          }
        }}
      >
        <DialogHeader>
          <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-destructive">{t('members.removeMember')}</DialogTitle>
          <DialogDescription>
            {t('members.removeMemberConfirm', {
              name: memberToRemove?.user.name || '',
              email: memberToRemove?.user.email || '',
              workspace: workspace?.name || '',
            })}
          </DialogDescription>
        </DialogHeader>

        {removeError && (
          <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20 my-2">
            {removeError}
          </div>
        )}

        <p className="text-xs text-muted-foreground py-2">
          {t('members.removeMemberWarning')}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMemberToRemove(null);
              setRemoveError(null);
            }}
            disabled={isRemovingMember}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (!memberToRemove) return;
              try {
                setRemoveError(null);
                await removeMember(memberToRemove.id);
                setMemberToRemove(null);
              } catch (err) {
                setRemoveError(
                  err instanceof Error ? err.message : 'Failed to remove member'
                );
              }
            }}
            disabled={isRemovingMember}
            className="cursor-pointer"
          >
            {isRemovingMember ? t('members.removing') : t('members.removeMemberBtn')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
