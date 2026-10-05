import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject } from '@/features/projects/use-projects';
import { useProjectTasks } from '@/features/tasks/use-tasks';
import { useWorkspaceMembers } from '@/features/workspaces/use-workspaces';
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
} from 'lucide-react';

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, updateProject } = useProject(projectId);
  const { members } = useWorkspaceMembers(project?.workspaceId);

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
  } = useProjectTasks(projectId, {
    search: search.trim() || undefined,
    status: status || undefined,
    priority: priority || undefined,
    assigneeId: assigneeId || undefined,
    sort,
    order,
    page,
    limit: 15,
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
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create task');
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
            <CheckCircle2 className="size-3" /> Done
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="info" className="gap-1">
            <Clock className="size-3" /> In Progress
          </Badge>
        );
      case 'TODO':
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="size-3" /> To Do
          </Badge>
        );
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'HIGH':
        return <Badge variant="destructive">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">Medium</Badge>;
      case 'LOW':
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link
              to={`/workspaces/${project?.workspaceId}/projects`}
              className="hover:text-foreground flex items-center gap-1"
            >
              <FolderKanban className="size-3.5" /> Projects
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
              title="Edit project"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <Edit2 className="size-3.5" />
            </button>
          </div>
          {project?.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)} className="cursor-pointer shrink-0">
          <Plus className="size-4 mr-1.5" />
          New Task
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-3 bg-card/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TaskStatus | '');
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </Select>
          </div>

          {/* Priority Filter */}
          <div>
            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as TaskPriority | '');
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </div>

          {/* Assignee Filter */}
          <div>
            <Select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="">All Assignees</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Sort & Order */}
          <div className="flex items-center gap-1">
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs flex-1"
            >
              <option value="createdAt">Created</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="title">Title</option>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
              title={`Sorting ${order.toUpperCase()}`}
              className="h-9 w-9 shrink-0 cursor-pointer"
            >
              <ArrowUpDown className="size-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          {isTasksLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-medium text-base mb-1">No tasks match your filters</p>
              <p className="text-sm text-muted-foreground mb-4">
                {search || status || priority || assigneeId
                  ? 'Try adjusting or clearing your search filters.'
                  : 'Start making progress by creating the first task in this project.'}
              </p>
              <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
                <Plus className="size-4 mr-1.5" />
                Add New Task
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3">Due Date</th>
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
                          to={`/tasks/${task.id}`}
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
                          <span className="text-muted-foreground/60 italic">Unassigned</span>
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
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total tasks)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="cursor-pointer h-7 px-2"
                >
                  <ChevronLeft className="size-3.5 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="cursor-pointer h-7 px-2"
                >
                  Next <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a task to {project?.name}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateTask}>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                {createError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="taskTitle">Title</Label>
              <Input
                id="taskTitle"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taskDesc">Description (optional)</Label>
              <Textarea
                id="taskDesc"
                placeholder="Add context, acceptance criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tStatus">Status</Label>
                <Select
                  id="tStatus"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tPriority">Priority</Label>
                <Select
                  id="tPriority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tAssignee">Assignee (optional)</Label>
                <Select
                  id="tAssignee"
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name} ({m.role})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tDueDate">Due Date (optional)</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !title.trim()}>
              {isCreating ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project name and description.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdateProject}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editProjName">Name</Label>
              <Input
                id="editProjName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editProjDesc">Description</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={!editName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
