import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useProject } from '@/features/projects/use-projects';
import { useProjectTasks } from '@/features/tasks/use-tasks';
import { useWorkspaceMembers } from '@/features/workspaces/use-workspaces';
import { useLanguage } from '@/lib/i18n/language-context';
import { KanbanBoard } from '@/features/tasks/KanbanBoard';
import type { TaskStatus, TaskPriority } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  MessageSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  Edit2,
  LayoutList,
  Kanban,
} from 'lucide-react';

export default function ProjectTasksPage() {
  const { workspaceId: paramWsId, projectId } = useParams<{ workspaceId?: string; projectId: string }>();
  const { project, updateProject } = useProject(projectId);
  const currentWorkspaceId = paramWsId || project?.workspaceId;
  const { members } = useWorkspaceMembers(currentWorkspaceId);
  const { t } = useLanguage();

  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get('view') === 'board' ? 'board' : 'list';

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [sort, setSort] = useState<string>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);

  const {
    tasks,
    pagination,
    isLoading: isTasksLoading,
    createTask,
    isCreating,
    moveTask,
  } = useProjectTasks(projectId, {
    search: search.trim() || undefined,
    status: viewMode === 'board' ? undefined : (status || undefined),
    priority: priority || undefined,
    assigneeId: assigneeId || undefined,
    sort: viewMode === 'board' ? 'position' : sort,
    order: viewMode === 'board' ? 'asc' : order,
    page: viewMode === 'board' ? 1 : page,
    limit: viewMode === 'board' ? 100 : 15,
  });

  // Create Task State
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('TODO');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Project State
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setCreateError(null);
      await createTask({
        title: title.trim(),
        description: description.trim() || null,
        status: newStatus,
        priority: newPriority,
        assigneeId: newAssigneeId || null,
        dueDate: newDueDate || null,
      });

      setTitle('');
      setDescription('');
      setNewStatus('TODO');
      setNewPriority('MEDIUM');
      setNewAssigneeId('');
      setNewDueDate('');
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await updateProject({
      name: editName.trim(),
      description: editDesc.trim() || null,
    });
    setEditProjectOpen(false);
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'DONE':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="size-3" /> {t('tasks.done')}
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="info" className="gap-1">
            <Clock className="size-3" /> {t('tasks.inProgress')}
          </Badge>
        );
      case 'TODO':
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="size-3" /> {t('tasks.toDo')}
          </Badge>
        );
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'HIGH':
        return <Badge variant="destructive">{t('tasks.high')}</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">{t('tasks.medium')}</Badge>;
      case 'LOW':
      default:
        return <Badge variant="secondary">{t('tasks.low')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link
              to={`/workspaces/${currentWorkspaceId}/projects`}
              className="hover:text-foreground flex items-center gap-1"
            >
              <FolderKanban className="size-3.5" /> {t('projects.title')}
            </Link>
            <span>/</span>
            <span className="font-medium text-foreground">{project?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{project?.name}</h1>
            <button
              onClick={() => {
                setEditName(project?.name || '');
                setEditDesc(project?.description || '');
                setEditProjectOpen(true);
              }}
              title={t('projects.editProject')}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <Edit2 className="size-3.5" />
            </button>
          </div>
          {project?.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('view', 'list');
                setSearchParams(next);
              }}
              className="h-8 px-2.5 text-xs font-medium cursor-pointer"
            >
              <LayoutList className="size-3.5 mr-1.5" />
              {t('tasks.list')}
            </Button>
            <Button
              type="button"
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('view', 'board');
                setSearchParams(next);
              }}
              className="h-8 px-2.5 text-xs font-medium cursor-pointer"
            >
              <Kanban className="size-3.5 mr-1.5" />
              {t('tasks.board')}
            </Button>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
            <Plus className="size-4 mr-1.5" />
            {t('tasks.newTask')}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-3 bg-card/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search */}
          <div className={viewMode === 'board' ? 'relative lg:col-span-2' : 'relative lg:col-span-2'}>
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={t('tasks.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Status Filter (List View Only) */}
          {viewMode === 'list' && (
            <div>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as TaskStatus | '');
                  setPage(1);
                }}
                className="h-9 text-xs"
              >
                <option value="">{t('tasks.allStatuses')}</option>
                <option value="TODO">{t('tasks.toDo')}</option>
                <option value="IN_PROGRESS">{t('tasks.inProgress')}</option>
                <option value="DONE">{t('tasks.done')}</option>
              </Select>
            </div>
          )}

          {/* Priority Filter */}
          <div className={viewMode === 'board' ? 'lg:col-span-2' : ''}>
            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as TaskPriority | '');
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="">{t('tasks.allPriorities')}</option>
              <option value="LOW">{t('tasks.low')}</option>
              <option value="MEDIUM">{t('tasks.medium')}</option>
              <option value="HIGH">{t('tasks.high')}</option>
            </Select>
          </div>

          {/* Assignee Filter */}
          <div className={viewMode === 'board' ? 'lg:col-span-2' : ''}>
            <Select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="">{t('tasks.allAssignees')}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Sort & Order (List View Only) */}
          {viewMode === 'list' && (
            <div className="flex items-center gap-1">
              <Select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs flex-1"
              >
                <option value="createdAt">{t('tasks.sortByCreated')}</option>
                <option value="dueDate">{t('tasks.sortByDueDate')}</option>
                <option value="priority">{t('tasks.sortByPriority')}</option>
                <option value="status">{t('tasks.sortByStatus')}</option>
                <option value="title">{t('tasks.sortByTitle')}</option>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
                title={`Sorting ${order.toUpperCase()}`}
                aria-label={`Toggle sort order, currently ${order.toUpperCase()}`}
                className="h-9 w-9 shrink-0 cursor-pointer"
              >
                <ArrowUpDown className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Main View: Board vs List */}
      {viewMode === 'board' ? (
        isTasksLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground bg-card rounded-xl border border-border">
            {t('tasks.loadingBoard')}
          </div>
        ) : (
          <KanbanBoard
            tasks={tasks}
            workspaceId={currentWorkspaceId}
            projectId={projectId}
            onMoveTask={moveTask}
            onAddTask={(colStatus) => {
              setNewStatus(colStatus);
              setCreateOpen(true);
            }}
          />
        )
      ) : (
        <Card>
          <CardContent className="p-0">
            {isTasksLoading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                {t('tasks.loadingTasks')}
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-medium text-base mb-1">{t('tasks.noTasks')}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {search || status || priority || assigneeId
                    ? t('tasks.noTasksAdjust')
                    : t('tasks.noTasksDesc')}
                </p>
                <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
                  <Plus className="size-4 mr-1.5" />
                  {t('tasks.newTask')}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                    <tr>
                      <th className="px-4 py-3">{t('tasks.taskTableTask')}</th>
                      <th className="px-4 py-3">{t('tasks.taskTableStatus')}</th>
                      <th className="px-4 py-3">{t('tasks.taskTablePriority')}</th>
                      <th className="px-4 py-3">{t('tasks.taskTableAssignee')}</th>
                      <th className="px-4 py-3">{t('tasks.taskTableDueDate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tasks.map((task) => (
                      <tr
                        key={task.id}
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3.5 font-medium">
                          <Link
                            to={`/workspaces/${currentWorkspaceId}/projects/${projectId}/tasks/${task.id}`}
                            className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors"
                          >
                            <span className="font-medium">{task.title}</span>
                            {(task._count?.comments || 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground font-normal">
                                <MessageSquare className="size-3" />
                                {task._count?.comments}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">{getStatusBadge(task.status)}</td>
                        <td className="px-4 py-3.5">{getPriorityBadge(task.priority)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {task.assignee ? (
                            <span className="font-medium text-foreground">
                              {task.assignee.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">{t('tasks.unassigned')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {task.dueDate ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3.5" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <div>
                  {t('tasks.pageOf', {
                    page: pagination.page,
                    totalPages: pagination.totalPages,
                    totalItems: pagination.totalItems,
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="cursor-pointer h-7 px-2"
                  >
                    <ChevronLeft className="size-3.5 mr-1" /> {t('common.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="cursor-pointer h-7 px-2"
                  >
                    {t('common.next')} <ChevronRight className="size-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>{t('tasks.createTaskTitle')}</DialogTitle>
          <DialogDescription>
            {t('tasks.createTaskDesc', { project: project?.name || '' })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateTask}>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                {createError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="taskTitle">{t('tasks.taskTitle')}</Label>
              <Input
                id="taskTitle"
                placeholder={t('tasks.taskTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taskDesc">{t('tasks.taskDesc')}</Label>
              <Textarea
                id="taskDesc"
                placeholder={t('tasks.taskDescPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tStatus">{t('tasks.status')}</Label>
                <Select
                  id="tStatus"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                >
                  <option value="TODO">{t('tasks.toDo')}</option>
                  <option value="IN_PROGRESS">{t('tasks.inProgress')}</option>
                  <option value="DONE">{t('tasks.done')}</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tPriority">{t('tasks.priority')}</Label>
                <Select
                  id="tPriority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                >
                  <option value="LOW">{t('tasks.low')}</option>
                  <option value="MEDIUM">{t('tasks.medium')}</option>
                  <option value="HIGH">{t('tasks.high')}</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tAssignee">{t('tasks.assignee')}</Label>
                <Select
                  id="tAssignee"
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                >
                  <option value="">{t('tasks.unassigned')}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name} ({m.role})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tDueDate">{t('tasks.dueDate')}</Label>
                <Input
                  id="tDueDate"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            </div>
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
            <Button type="submit" disabled={isCreating || !title.trim()}>
              {isCreating ? t('tasks.creating') : t('tasks.createTaskBtn')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogHeader>
          <DialogTitle>{t('projects.editProjectTitle')}</DialogTitle>
          <DialogDescription>{t('projects.editProjectDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdateProject}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editProjName">{t('projects.name')}</Label>
              <Input
                id="editProjName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editProjDesc">{t('projects.description')}</Label>
              <Textarea
                id="editProjDesc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditProjectOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!editName.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
