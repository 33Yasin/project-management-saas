import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
import { Building2, Plus, ArrowRight } from 'lucide-react';

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { workspaces, isLoading, createWorkspace, isCreating } = useWorkspaces();
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [createWsError, setCreateWsError] = useState<string | null>(null);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      setCreateWsError(null);
      const created = await createWorkspace({ name: newWsName.trim() });
      setNewWsName('');
      setCreateWsOpen(false);
      navigate(`/workspaces/${created.id}/projects`);
    } catch (err) {
      setCreateWsError(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground text-sm">Loading workspaces...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Select a workspace to manage its projects, tasks, and team members.
          </p>
        </div>
        <Button onClick={() => setCreateWsOpen(true)} className="cursor-pointer">
          <Plus className="size-4 mr-1.5" />
          Create Workspace
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Building2 className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No workspaces yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            Get started by creating your first workspace to collaborate with your team.
          </p>
          <Button onClick={() => setCreateWsOpen(true)} className="cursor-pointer">
            <Plus className="size-4 mr-1.5" />
            Create Workspace
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <Card
              key={ws.id}
              className="hover:border-primary/50 transition-all hover:shadow-xs group flex flex-col justify-between"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  {ws.role && (
                    <Badge variant={ws.role === 'OWNER' ? 'default' : 'secondary'}>
                      {ws.role}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {ws.name}
                </CardTitle>
                <CardDescription>
                  Created on {new Date(ws.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Link
                  to={`/workspaces/${ws.id}/projects`}
                  className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between cursor-pointer')}
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="size-4" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Workspace Dialog */}
      <Dialog open={createWsOpen} onOpenChange={setCreateWsOpen}>
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Workspaces organize projects, tasks, and team members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateWorkspace}>
          <div className="space-y-4 py-2">
            {createWsError && (
              <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                {createWsError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="wsName">Workspace Name</Label>
              <Input
                id="wsName"
                placeholder="e.g. Engineering Team"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateWsOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !newWsName.trim()}>
              {isCreating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
