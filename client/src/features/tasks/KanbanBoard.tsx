import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@/types/api';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { useLanguage } from '@/lib/i18n/language-context';

interface KanbanBoardProps {
  tasks: Task[];
  workspaceId?: string;
  projectId?: string;
  onMoveTask: (params: { taskId: string; targetIndex: number; status?: TaskStatus }) => Promise<unknown>;
  onAddTask?: (status: TaskStatus) => void;
}

const STATIC_COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export function KanbanBoard({
  tasks,
  workspaceId,
  projectId,
  onMoveTask,
  onAddTask,
}: KanbanBoardProps) {
  const { t } = useLanguage();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const columns: { status: TaskStatus; title: string }[] = [
    { status: 'TODO', title: t('kanban.toDo') },
    { status: 'IN_PROGRESS', title: t('kanban.inProgress') },
    { status: 'DONE', title: t('kanban.done') },
  ];

  // Setup sensors with activation constraints
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // 5px movement required to trigger drag; allows clicking without accidental dragging
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // Group and sort tasks by status and position
  const todoTasks = tasks
    .filter((t) => t.status === 'TODO')
    .sort((a, b) => a.position - b.position);
  const inProgressTasks = tasks
    .filter((t) => t.status === 'IN_PROGRESS')
    .sort((a, b) => a.position - b.position);
  const doneTasks = tasks
    .filter((t) => t.status === 'DONE')
    .sort((a, b) => a.position - b.position);

  const getColumnTasks = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return todoTasks;
      case 'IN_PROGRESS':
        return inProgressTasks;
      case 'DONE':
        return doneTasks;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    const sourceStatus = draggedTask.status;
    let destinationStatus: TaskStatus = sourceStatus;
    let targetIndex = 0;

    // Is 'over' a column directly?
    const overData = over.data.current;
    if (overData?.type === 'column') {
      destinationStatus = overData.status as TaskStatus;
      const destColumnTasks = getColumnTasks(destinationStatus);
      targetIndex = destColumnTasks.length;
    } else if (overData?.type === 'task') {
      const overTask = overData.task as Task;
      destinationStatus = overTask.status;
      const destColumnTasks = getColumnTasks(destinationStatus);
      const overIndex = destColumnTasks.findIndex((t) => t.id === overId);
      targetIndex = overIndex >= 0 ? overIndex : destColumnTasks.length;
    } else if (STATIC_COLUMNS.includes(overId as TaskStatus)) {
      destinationStatus = overId as TaskStatus;
      const destColumnTasks = getColumnTasks(destinationStatus);
      targetIndex = destColumnTasks.length;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        destinationStatus = overTask.status;
        const destColumnTasks = getColumnTasks(destinationStatus);
        const overIndex = destColumnTasks.findIndex((t) => t.id === overId);
        targetIndex = overIndex >= 0 ? overIndex : destColumnTasks.length;
      }
    }

    // Check if task actually moved
    if (sourceStatus === destinationStatus) {
      const columnTasks = getColumnTasks(sourceStatus);
      const currentIndex = columnTasks.findIndex((t) => t.id === activeId);
      if (currentIndex === targetIndex) {
        return; // No position change
      }
    }

    await onMoveTask({
      taskId: activeId,
      status: destinationStatus,
      targetIndex,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col md:flex-row items-start gap-4 overflow-x-auto pb-4 pt-1 w-full">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            title={column.title}
            tasks={getColumnTasks(column.status)}
            workspaceId={workspaceId}
            projectId={projectId}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask ? (
          <KanbanCard
            task={activeTask}
            workspaceId={workspaceId}
            projectId={projectId}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
