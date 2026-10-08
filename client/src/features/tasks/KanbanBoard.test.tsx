import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KanbanBoard } from './KanbanBoard';
import { renderWithProviders } from '@/test/test-utils';
import type { Task } from '@/types/api';

const mockTasks: Task[] = [
  {
    id: 't-1',
    projectId: 'p-1',
    title: 'Design landing page hero',
    description: 'Create responsive hero layout',
    status: 'TODO',
    priority: 'HIGH',
    position: 0,
    assigneeId: 'u-1',
    createdById: 'u-1',
    dueDate: '2026-11-01T00:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignee: { id: 'u-1', name: 'Alice Walker', email: 'alice@example.com' },
    _count: { comments: 3 },
  },
  {
    id: 't-2',
    projectId: 'p-1',
    title: 'Setup PostgreSQL schema',
    description: null,
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    position: 0,
    assigneeId: null,
    createdById: 'u-1',
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { comments: 0 },
  },
  {
    id: 't-3',
    projectId: 'p-1',
    title: 'Implement authentication',
    description: 'Use argon2 and express-session',
    status: 'DONE',
    priority: 'LOW',
    position: 0,
    assigneeId: 'u-2',
    createdById: 'u-1',
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignee: { id: 'u-2', name: 'Bob Smith', email: 'bob@example.com' },
    _count: { comments: 1 },
  },
];

describe('KanbanBoard Component Tests', () => {
  it('renders all three Kanban columns (To Do, In Progress, Done) with task counts', () => {
    const handleMove = vi.fn().mockResolvedValue({});

    renderWithProviders(
      <KanbanBoard
        tasks={mockTasks}
        workspaceId="ws-1"
        projectId="p-1"
        onMoveTask={handleMove}
      />
    );

    expect(screen.getByRole('heading', { name: /^to do$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^in progress$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^done$/i })).toBeInTheDocument();

    // Check task titles are present in the document
    expect(screen.getByText('Design landing page hero')).toBeInTheDocument();
    expect(screen.getByText('Setup PostgreSQL schema')).toBeInTheDocument();
    expect(screen.getByText('Implement authentication')).toBeInTheDocument();
  });

  it('renders card details including priority, assignee and comments count', () => {
    const handleMove = vi.fn().mockResolvedValue({});

    renderWithProviders(
      <KanbanBoard
        tasks={mockTasks}
        workspaceId="ws-1"
        projectId="p-1"
        onMoveTask={handleMove}
      />
    );

    // High priority badge
    expect(screen.getByText('High')).toBeInTheDocument();
    // Assignee first name
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // Comments count
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows empty drop area when a column has zero tasks', () => {
    const handleMove = vi.fn().mockResolvedValue({});
    // Only TODO tasks, leaving IN_PROGRESS and DONE empty
    const singleColumnTasks = [mockTasks[0]];

    renderWithProviders(
      <KanbanBoard
        tasks={singleColumnTasks}
        workspaceId="ws-1"
        projectId="p-1"
        onMoveTask={handleMove}
      />
    );

    const emptyDropAreas = screen.getAllByText(/drop tasks here/i);
    expect(emptyDropAreas.length).toBe(2); // for IN_PROGRESS and DONE
  });

  it('calls onAddTask with appropriate status when column add button is clicked', async () => {
    const user = userEvent.setup();
    const handleMove = vi.fn().mockResolvedValue({});
    const handleAdd = vi.fn();

    renderWithProviders(
      <KanbanBoard
        tasks={mockTasks}
        workspaceId="ws-1"
        projectId="p-1"
        onMoveTask={handleMove}
        onAddTask={handleAdd}
      />
    );

    const addTodoBtn = screen.getByRole('button', { name: /add task to to do/i });
    await user.click(addTodoBtn);

    expect(handleAdd).toHaveBeenCalledWith('TODO');

    const addDoneBtn = screen.getByRole('button', { name: /add task to done/i });
    await user.click(addDoneBtn);

    expect(handleAdd).toHaveBeenCalledWith('DONE');
  });

  it('has accessible drag handle buttons with descriptive aria labels', () => {
    const handleMove = vi.fn().mockResolvedValue({});

    renderWithProviders(
      <KanbanBoard
        tasks={mockTasks}
        workspaceId="ws-1"
        projectId="p-1"
        onMoveTask={handleMove}
      />
    );

    expect(
      screen.getByRole('button', { name: /drag task design landing page hero/i })
    ).toBeInTheDocument();
  });
});
