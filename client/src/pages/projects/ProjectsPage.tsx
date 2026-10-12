import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjects } from '@/features/projects/use-projects';
import { useWorkspace, useWorkspaceMembers } from '@/features/workspaces/use-workspaces';
import { useLanguage } from '@/lib/i18n/language-context';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { FolderKanban, Plus, ArrowRight, CheckSquare, Users } from 'lucide-react';

export default function ProjectsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspace } = useWorkspace(workspaceId);
  const { projects, isLoading, createProject, isCreating } = useProjects(workspaceId);
  const { members = [] } = useWorkspaceMembers(workspaceId);
  const { t } = useLanguage();

  const canCreateProject = workspace?.role === 'OWNER' || workspace?.role === 'ADMIN';

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setCreateError(null);
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      });
      setName('');
      setDescription('');
      setSelectedMemberIds([]);
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('projects.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('projects.subtitle', { workspace: workspace?.name || '' })}
          </p>
        </div>
        {canCreateProject && (
          <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
            <Plus className="size-4 mr-1.5" />
            {t('projects.newProject')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <p className="text-muted-foreground text-sm">{t('projects.loadingProjects')}</p>
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <FolderKanban className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{t('projects.noProjects')}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            {t('projects.noProjectsDesc')}
          </p>
          {canCreateProject && (
            <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
              <Plus className="size-4 mr-1.5" />
              {t('projects.createFirstProject')}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="hover:border-primary/50 transition-all hover:shadow-xs group flex flex-col justify-between"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <FolderKanban className="size-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Users className="size-3" />
                      <span>{project._count?.members ?? project.members?.length ?? 0} {t('projects.membersBadge')}</span>
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      <CheckSquare className="size-3" />
                      <span>{t('projects.tasksCount', { count: project._count?.tasks || 0 })}</span>
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {project.name}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {project.description || t('projects.noDescription')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Link
                  to={`/workspaces/${workspaceId}/projects/${project.id}/tasks`}
                  className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between cursor-pointer')}
                >
                  <span>{t('projects.viewTasks')}</span>
                  <ArrowRight className="size-4" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>{t('projects.createProjectTitle')}</DialogTitle>
          <DialogDescription>
            {t('projects.createProjectDesc', { workspace: workspace?.name || '' })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate}>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                {createError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="projName">{t('projects.projectName')}</Label>
              <Input
                id="projName"
                placeholder={t('projects.projectNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projDesc">{t('projects.description')}</Label>
              <Textarea
                id="projDesc"
                placeholder={t('projects.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
            </div>
            {members.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('projects.assignMembers')}</Label>
                <p className="text-xs text-muted-foreground">{t('projects.assignMembersDesc')}</p>
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border p-2 bg-muted/20">
                  {members.map((member) => {
                    const isSelected = selectedMemberIds.includes(member.userId);
                    return (
                      <label
                        key={member.userId}
                        className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted cursor-pointer text-xs select-none"
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 rounded border-input text-primary focus:ring-primary"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedMemberIds((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== member.userId)
                                : [...prev, member.userId]
                            );
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground">{member.user.name}</span>
                          <span className="text-muted-foreground ml-1.5">({member.user.email})</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {member.role}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isCreating}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? t('projects.creating') : t('projects.createProjectBtn')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
