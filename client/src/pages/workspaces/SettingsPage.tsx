import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import {
  useWorkspace,
  useWorkspaceMembers,
} from '@/features/workspaces/use-workspaces';
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

  const [name, setName] = useState('');
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  // Transfer Ownership
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Delete Workspace
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (workspace?.name) {
      setName(workspace.name);
    }
  }, [workspace?.name]);

  const isOwner = workspace?.role === 'OWNER';
  const otherMembers = members.filter((m) => m.userId !== user?.id);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === workspace?.name) return;

    try {
      setNameMessage(null);
      await updateWorkspace({ name: name.trim() });
      setNameMessage('Workspace name updated successfully.');
      setTimeout(() => setNameMessage(null), 3000);
    } catch (err: any) {
      setNameMessage(err?.message || 'Failed to update name');
    }
  };

  const handleTransferOwnership = async () => {
    if (!targetUserId) return;

    try {
      setTransferError(null);
      await transferOwnership({ targetUserId });
      setTransferOpen(false);
      navigate(`/workspaces/${workspaceId}/projects`);
    } catch (err: any) {
      setTransferError(err?.message || 'Failed to transfer ownership');
    }
  };

  const handleDeleteWorkspace = async () => {
    try {
      setDeleteError(null);
      await deleteWorkspace();
      setDeleteOpen(false);
      navigate('/workspaces', { replace: true });
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete workspace');
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage general workspace settings, ownership, and deletions.
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <form onSubmit={handleUpdateName}>
          <CardHeader>
            <CardTitle className="text-lg">General Information</CardTitle>
            <CardDescription>Update your workspace display name.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nameMessage && (
              <div className="p-2.5 text-xs rounded-md bg-primary/10 text-primary border border-primary/20">
                {nameMessage}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="wsName">Workspace Name</Label>
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
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Ownership Transfer (OWNER only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transfer Ownership</CardTitle>
            <CardDescription>
              Transfer ownership of this workspace to another team member. You will remain an Admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {otherMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                There are no other members in this workspace to transfer ownership to.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="targetMember">New Owner</Label>
                <Select
                  id="targetMember"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                >
                  <option value="">Select a member...</option>
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
              Transfer Ownership
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Danger Zone (OWNER only) */}
      {isOwner && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete this workspace and all associated projects, tasks, comments, and member records.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-end border-t border-destructive/20 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              className="cursor-pointer"
            >
              Delete Workspace
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogHeader>
          <DialogTitle>Confirm Ownership Transfer</DialogTitle>
          <DialogDescription>
            Are you sure you want to transfer ownership of this workspace? You will be demoted to an ADMIN role.
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleTransferOwnership}
            disabled={isTransferring}
          >
            {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Workspace Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-destructive">Delete Workspace</DialogTitle>
          <DialogDescription>
            This action cannot be undone. All projects, tasks, and comments will be permanently erased.
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
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteWorkspace}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
