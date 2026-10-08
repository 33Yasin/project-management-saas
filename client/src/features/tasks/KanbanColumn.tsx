import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@/types/api';
import { KanbanCard } from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Plus, CircleDot, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  workspaceId?: string;
  projectId?: string;
  onAddTask?: (status: TaskStatus) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  workspaceId,
  projectId,
  onAddTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status,
    },
  });

  const getStatusIcon = (colStatus: TaskStatus) => {
    switch (colStatus) {
      case 'TODO':
        return <CircleDot className="size-4 text-blue-500" />;
      case 'IN_PROGRESS':
        return <Clock className="size-4 text-amber-500" />;
      case 'DONE':
        return <CheckCircle2 className="size-4 text-emerald-500" />;
    }
  };

  const getStatusAccent = (colStatus: TaskStatus) => {
    switch (colStatus) {
      case 'TODO':
        return 'border-t-blue-500';
      case 'IN_PROGRESS':
        return 'border-t-amber-500';
      case 'DONE':
        return 'border-t-emerald-500';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col flex-1 min-w-[280px] max-w-[380px] bg-muted/40 rounded-xl border border-border/80 border-t-2 p-3 transition-colors',
        getStatusAccent(status),
        isOver && 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2">
          {getStatusIcon(status)}
          <h2 className="font-semibold text-sm text-foreground">{title}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onAddTask(status)}
            aria-label={`Add task to ${title}`}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>

      {/* Cards List / Drop Area */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 flex flex-col gap-2 min-h-[150px]">
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              workspaceId={workspaceId}
              projectId={projectId}
            />
          ))}

          {tasks.length === 0 && (
            <div className="flex-1 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center p-6 text-xs text-muted-foreground/60 select-none">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
