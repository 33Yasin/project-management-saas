import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { useTask, useTaskComments } from '@/features/tasks/use-tasks';
import { useWorkspaceMembers } from '@/features/workspaces/use-workspaces';
import type { TaskStatus, TaskPriority } from '@/types/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ChevronLeft,
  Trash2,
  Send,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { task, isLoading, updateTask, isUpdating, deleteTask, isDeleting } = useTask(taskId);
  const { comments, createComment, isCreating, deleteComment } = useTaskComments(taskId);

  const workspaceId = task?.project?.workspaceId;
  const { members } = useWorkspaceMembers(workspaceId);

  const [newComment, setNewComment] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const currentMember = members.find((m) => m.userId === user?.id);
  const canDeleteAnyComment =
    currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setCommentError(null);
      await createComment(newComment.trim());
      setNewComment('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment');
    }
  };

  const handleDeleteTask = async () => {
    await deleteTask();
    navigate(`/projects/${task?.projectId}/tasks`, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Loading task details...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-12 text-center">
        <p className="text-base font-semibold mb-2">Task not found</p>
        <Link
          to="/workspaces"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Back to Workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to={`/projects/${task.projectId}/tasks`}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4 mr-1" />
          Back to {task.project?.name || 'Project'} Tasks
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer h-8"
        >
          <Trash2 className="size-3.5 mr-1.5" />
          Delete Task
        </Button>
      </div>

      {/* Main Grid: Details + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Task content and Comments */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold">{task.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-foreground/90 whitespace-pre-wrap min-h-[60px]">
                {task.description || (
                  <span className="text-muted-foreground italic text-xs">
                    No description provided.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="size-4" />
                Discussion & Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing comments list */}
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 italic">
                  No comments yet. Start the conversation below.
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const isAuthor = comment.authorId === user?.id;
                    const canDelete = isAuthor || canDeleteAnyComment;

                    return (
                      <div
                        key={comment.id}
                        className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1.5 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {comment.author.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-xs text-foreground">
                              {comment.author.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleDateString()} at{' '}
                              {new Date(comment.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => deleteComment(comment.id)}
                              title="Delete comment"
                              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap text-xs pl-8">
                          {comment.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="pt-3 border-t border-border space-y-2">
                {commentError && (
                  <p className="text-xs text-destructive">{commentError}</p>
                )}
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  disabled={isCreating}
                  className="text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreating || !newComment.trim()}
                    className="cursor-pointer gap-1.5 h-8 text-xs"
                  >
                    <Send className="size-3" />
                    {isCreating ? 'Posting...' : 'Post Comment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Properties sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Status */}
              <div className="space-y-1.5">
                <Label htmlFor="propStatus" className="text-xs text-muted-foreground">
                  Status
                </Label>
                <Select
                  id="propStatus"
                  value={task.status}
                  onChange={(e) => updateTask({ status: e.target.value as TaskStatus })}
                  disabled={isUpdating}
                  className="h-8 text-xs"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label htmlFor="propPriority" className="text-xs text-muted-foreground">
                  Priority
                </Label>
                <Select
                  id="propPriority"
                  value={task.priority}
                  onChange={(e) => updateTask({ priority: e.target.value as TaskPriority })}
                  disabled={isUpdating}
                  className="h-8 text-xs"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label htmlFor="propAssignee" className="text-xs text-muted-foreground">
                  Assignee
                </Label>
                <Select
                  id="propAssignee"
                  value={task.assigneeId || ''}
                  onChange={(e) =>
                    updateTask({ assigneeId: e.target.value ? e.target.value : null })
                  }
                  disabled={isUpdating}
                  className="h-8 text-xs"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label htmlFor="propDueDate" className="text-xs text-muted-foreground">
                  Due Date
                </Label>
                <input
                  id="propDueDate"
                  type="date"
                  value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                  onChange={(e) =>
                    updateTask({ dueDate: e.target.value ? e.target.value : null })
                  }
                  disabled={isUpdating}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="pt-3 border-t border-border space-y-2 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Created by:</span>
                  <span className="font-medium text-foreground">
                    {task.createdBy?.name || 'User'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Created at:</span>
                  <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Project:</span>
                  <span className="font-medium text-foreground">
                    {task.project?.name}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Task Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-destructive">Delete Task</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete "{task.title}" and its comments?
          </DialogDescription>
        </DialogHeader>
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
            onClick={handleDeleteTask}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Task'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
