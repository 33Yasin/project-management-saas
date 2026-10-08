import { useState } from 'react';
import { useTaskActivities } from './use-activities';
import type { Activity, ActivityType } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  History,
  PlusCircle,
  ArrowRightLeft,
  UserCheck,
  Edit3,
  MessageSquare,
  Trash2,
  Paperclip,
  Users,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

interface TaskActivityTimelineProps {
  taskId: string;
}

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'TASK_CREATED':
      return <PlusCircle className="size-4 text-emerald-500" />;
    case 'TASK_STATUS_CHANGED':
      return <ArrowRightLeft className="size-4 text-blue-500" />;
    case 'TASK_ASSIGNEE_CHANGED':
      return <UserCheck className="size-4 text-purple-500" />;
    case 'TASK_UPDATED':
      return <Edit3 className="size-4 text-amber-500" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="size-4 text-cyan-500" />;
    case 'COMMENT_DELETED':
      return <Trash2 className="size-4 text-rose-500" />;
    case 'ATTACHMENT_ADDED':
    case 'ATTACHMENT_DELETED':
      return <Paperclip className="size-4 text-indigo-500" />;
    case 'MEMBER_JOINED':
    case 'MEMBER_REMOVED':
      return <Users className="size-4 text-violet-500" />;
    case 'OWNERSHIP_TRANSFERRED':
      return <ShieldAlert className="size-4 text-orange-500" />;
    default:
      return <HelpCircle className="size-4 text-muted-foreground" />;
  }
}

function formatStatus(status: unknown): string {
  if (typeof status !== 'string') return '';
  switch (status) {
    case 'TODO':
      return 'To Do';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'DONE':
      return 'Done';
    default:
      return status;
  }
}

interface ActivityMetadata {
  from?: string;
  to?: string;
  assigneeName?: string;
  reordered?: boolean;
  fields?: string[];
  preview?: string;
  commentId?: string;
  title?: string;
  [key: string]: unknown;
}

function renderActivityDescription(activity: Activity) {
  const actorName = activity.actor?.name || 'Someone';
  const meta = (activity.metadata as ActivityMetadata) || {};

  switch (activity.type) {
    case 'TASK_CREATED':
      return (
        <span>
          <strong className="font-medium text-foreground">{actorName}</strong> created this task
        </span>
      );

    case 'TASK_STATUS_CHANGED':
      return (
        <span>
          <strong className="font-medium text-foreground">{actorName}</strong> changed status from{' '}
          <span className="font-semibold text-muted-foreground">{formatStatus(meta.from)}</span> to{' '}
          <span className="font-semibold text-foreground">{formatStatus(meta.to)}</span>
        </span>
      );

    case 'TASK_ASSIGNEE_CHANGED':
      if (meta.to) {
        return (
          <span>
            <strong className="font-medium text-foreground">{actorName}</strong> assigned this task to{' '}
            <strong className="font-medium text-foreground">{meta.assigneeName || 'a member'}</strong>
          </span>
        );
      }
      return (
        <span>
          <strong className="font-medium text-foreground">{actorName}</strong> unassigned this task
        </span>
      );

    case 'TASK_UPDATED':
      if (meta.reordered) {
        return (
          <span>
            <strong className="font-medium text-foreground">{actorName}</strong> reordered task position
          </span>
        );
      }
      return (
        <span>
          <strong className="font-medium text-foreground">{actorName}</strong> updated task details
          {meta.fields && Array.isArray(meta.fields) && meta.fields.length > 0 && (
            <span className="text-muted-foreground text-[11px] ml-1">
              ({meta.fields.join(', ')})
            </span>
          )}
        </span>
      );

    case 'COMMENT_ADDED':
      return (
        <span>
          <strong className="font-medium text-foreground">{actorName}</strong> commented
          {meta.preview ? (
            <span className="italic text-muted-foreground ml-1">
              &ldquo;{meta.preview}&rdquo;
            </span>
          ) : null}
        </span>
      );

    case 'COMMENT_DELETED':
      return (
        <span>
          <strong className="font-medium text-foreground">{actorName}</strong> deleted a comment
        </span>
      );

    default:
      return (
        <span>
          <strong className="font-medium text-foreground">{actorName}</strong> performed {activity.type}
        </span>
      );
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function TaskActivityTimeline({ taskId }: TaskActivityTimelineProps) {
  const [page, setPage] = useState(1);
  const { activities, pagination, isLoading, isError } = useTaskActivities(taskId, page, 10);

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold tracking-wide">
              Activity History
            </CardTitle>
          </div>
          {pagination && pagination.totalItems > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
              {pagination.totalItems} {pagination.totalItems === 1 ? 'event' : 'events'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Loading activity log...
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-xs text-destructive">
            Failed to load activity history.
          </div>
        ) : activities.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No activity recorded yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/60">
            {activities.map((activity) => (
              <div key={activity.id} className="relative flex items-start gap-3 text-xs group">
                {/* Timeline node */}
                <div className="absolute -left-[19px] top-0.5 rounded-full bg-background p-0.5 border border-border shadow-2xs">
                  {getActivityIcon(activity.type)}
                </div>

                {/* Content */}
                <div className="flex-1 bg-muted/30 hover:bg-muted/50 transition-colors p-2.5 rounded-lg border border-border/40 space-y-1">
                  <div className="text-xs leading-relaxed">
                    {renderActivityDescription(activity)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/80">
                    {formatDate(activity.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 text-xs px-2.5"
                >
                  Previous
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="h-7 text-xs px-2.5"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export default TaskActivityTimeline;
