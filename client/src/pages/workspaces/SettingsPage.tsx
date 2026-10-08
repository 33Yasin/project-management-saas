import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import {
  useWorkspace,
  useWorkspaceMembers,
} from '@/features/workspaces/use-workspaces';
import { useLanguage } from '@/lib/i18n/language-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    workspace,
    updateWorkspace,
    isUpdating,
    deleteWorkspace,
    isDeleting,
    transferOwnership,
    isTransferring,
  } = useWorkspace(workspaceId);
  const { members } = useWorkspaceMembers(workspaceId);

  const [name, setName] = useState(workspace?.name || '');
  const [prevWorkspaceName, setPrevWorkspaceName] = useState(workspace?.name);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  if (workspace?.name && workspace.name !== prevWorkspaceName) {
    setPrevWorkspaceName(workspace.name);
    setName(workspace.name);
  }

  // Transfer Ownership
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Delete Workspace
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isOwner = workspace?.role === 'OWNER';
  const otherMembers = members.filter((m) => m.userId !== user?.id);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === workspace?.name) return;

    try {
      setNameMessage(null);
      await updateWorkspace({ name: name.trim() });
      setNameMessage(t('workspaces.nameUpdated'));
      setTimeout(() => setNameMessage(null), 3000);
    } catch (err) {
      setNameMessage(err instanceof Error ? err.message : 'Failed to update name');
    }
  };

  const handleTransferOwnership = async () => {
    if (!targetUserId) return;

    try {
      setTransferError(null);
      await transferOwnership({ targetUserId });
      setTransferOpen(false);
      navigate(`/workspaces/${workspaceId}/projects`);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    }
  };

  const handleDeleteWorkspace = async () => {
    try {
      setDeleteError(null);
      await deleteWorkspace();
      setDeleteOpen(false);
      navigate('/workspaces', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('workspaces.settingsTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('workspaces.settingsSubtitle')}
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <form onSubmit={handleUpdateName}>
          <CardHeader>
            <CardTitle className="text-lg">{t('workspaces.generalInfo')}</CardTitle>
            <CardDescription>{t('workspaces.generalInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nameMessage && (
              <div className="p-2.5 text-xs rounded-md bg-primary/10 text-primary border border-primary/20">
                {nameMessage}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="wsName">{t('workspaces.workspaceName')}</Label>
              <Input
                id="wsName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t border-border pt-4">
            <Button
              type="submit"
              disabled={isUpdating || !name.trim() || name === workspace?.name}
              className="cursor-pointer"
            >
              {isUpdating ? t('projects.creating') : t('common.save')}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Ownership Transfer (OWNER only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('workspaces.transferOwnership')}</CardTitle>
            <CardDescription>
              {t('workspaces.transferOwnershipDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {otherMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('workspaces.noOtherMembers')}
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="targetMember">{t('workspaces.newOwner')}</Label>
                <Select
                  id="targetMember"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                >
                  <option value="">{t('workspaces.selectMember')}</option>
                  {otherMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name} ({m.user.email}) - {m.role}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={!targetUserId || otherMembers.length === 0}
              onClick={() => setTransferOpen(true)}
              className="cursor-pointer"
            >
              {t('workspaces.transferOwnership')}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Danger Zone (OWNER only) */}
      {isOwner && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">{t('workspaces.dangerZone')}</CardTitle>
            <CardDescription>
              {t('workspaces.dangerZoneDesc')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-end border-t border-destructive/20 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              className="cursor-pointer"
            >
              {t('workspaces.deleteWorkspace')}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogHeader>
          <DialogTitle>{t('workspaces.transferDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('workspaces.transferDialogDesc')}
          </DialogDescription>
        </DialogHeader>
        {transferError && (
          <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20 my-2">
            {transferError}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setTransferOpen(false)}
            disabled={isTransferring}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleTransferOwnership}
            disabled={isTransferring}
          >
            {isTransferring ? t('workspaces.transferring') : t('workspaces.confirmTransfer')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Workspace Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-destructive">{t('workspaces.deleteWorkspace')}</DialogTitle>
          <DialogDescription>
            {t('workspaces.deleteWarning')}
          </DialogDescription>
        </DialogHeader>
        {deleteError && (
          <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20 my-2">
            {deleteError}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(false)}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteWorkspace}
            disabled={isDeleting}
          >
            {isDeleting ? t('workspaces.deleting') : t('workspaces.deletePermanently')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
