import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import type { Task } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Calendar, User as UserIcon, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanCardProps {
  task: Task;
  workspaceId?: string;
  projectId?: string;
  isOverlay?: boolean;
}

export function KanbanCard({ task, workspaceId, projectId, isOverlay = false }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityBadge = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400">Medium</Badge>;
      case 'LOW':
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Low</Badge>;
    }
  };

  const taskUrl = workspaceId && projectId
    ? `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`
    : '#';

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="kanban-card"
      className={cn(
        'group relative bg-card text-card-foreground border border-border/80 rounded-lg p-3 shadow-2xs hover:shadow-sm hover:border-primary/40 transition-all select-none',
        isDragging && 'opacity-30 border-dashed border-primary',
        isOverlay && 'shadow-lg border-primary/60 rotate-1 scale-102 cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          to={taskUrl}
          className="font-medium text-sm text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug flex-1"
          onClick={(e) => {
            if (isDragging) e.preventDefault();
          }}
        >
          {task.title}
        </Link>
        <button
          {...attributes}
          {...listeners}
          aria-label={`Drag task ${task.title}`}
          className="p-0.5 -mr-1 text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing rounded transition-colors touch-none"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {getPriorityBadge(task.priority)}
          {task.dueDate && (
            <span className="flex items-center gap-1 text-[11px]">
              <Calendar className="size-3" />
              {new Date(task.dueDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {(task._count?.comments || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[11px]">
              <MessageSquare className="size-3" />
              {task._count?.comments}
            </span>
          )}
          {task.assignee ? (
            <span
              className="flex items-center gap-1 text-[11px] font-medium text-foreground/80 max-w-[90px] truncate"
              title={`Assigned to ${task.assignee.name}`}
            >
              <span className="size-4.5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold shrink-0">
                {task.assignee.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{task.assignee.name.split(' ')[0]}</span>
            </span>
          ) : (
            <span title="Unassigned">
              <UserIcon className="size-3.5 text-muted-foreground/30" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
