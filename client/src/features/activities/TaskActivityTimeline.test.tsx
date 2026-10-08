import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { TaskActivityTimeline } from './TaskActivityTimeline';
import { renderWithProviders } from '@/test/test-utils';
import type { Activity } from '@/types/api';

function mockJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

describe('TaskActivityTimeline Component Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    // Hang fetch indefinitely
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<TaskActivityTimeline taskId="task-123" />);

    expect(screen.getByText(/loading activity log/i)).toBeInTheDocument();
  });

  it('renders empty state when there are no activities', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        items: [],
        pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
      })
    );

    renderWithProviders(<TaskActivityTimeline taskId="task-123" />);

    await waitFor(() => {
      expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument();
    });
  });

  it('renders various activity events correctly', async () => {
    const mockActivities: Activity[] = [
      {
        id: 'act-1',
        workspaceId: 'ws-1',
        projectId: 'p-1',
        taskId: 't-1',
        actorId: 'u-1',
        type: 'TASK_CREATED',
        metadata: { title: 'First Task' },
        createdAt: '2026-10-08T09:00:00.000Z',
        actor: { id: 'u-1', name: 'Alice Walker', email: 'alice@example.com' },
      },
      {
        id: 'act-2',
        workspaceId: 'ws-1',
        projectId: 'p-1',
        taskId: 't-1',
        actorId: 'u-1',
        type: 'TASK_STATUS_CHANGED',
        metadata: { from: 'TODO', to: 'IN_PROGRESS' },
        createdAt: '2026-10-08T09:05:00.000Z',
        actor: { id: 'u-1', name: 'Alice Walker', email: 'alice@example.com' },
      },
      {
        id: 'act-3',
        workspaceId: 'ws-1',
        projectId: 'p-1',
        taskId: 't-1',
        actorId: 'u-1',
        type: 'TASK_ASSIGNEE_CHANGED',
        metadata: { to: 'u-2', assigneeName: 'Bob Smith' },
        createdAt: '2026-10-08T09:10:00.000Z',
        actor: { id: 'u-1', name: 'Alice Walker', email: 'alice@example.com' },
      },
      {
        id: 'act-4',
        workspaceId: 'ws-1',
        projectId: 'p-1',
        taskId: 't-1',
        actorId: 'u-2',
        type: 'COMMENT_ADDED',
        metadata: { commentId: 'c-1', preview: 'Working on it!' },
        createdAt: '2026-10-08T09:15:00.000Z',
        actor: { id: 'u-2', name: 'Bob Smith', email: 'bob@example.com' },
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        items: mockActivities,
        pagination: { page: 1, limit: 10, totalItems: 4, totalPages: 1 },
      })
    );

    renderWithProviders(<TaskActivityTimeline taskId="t-1" />);

    // Wait for activities to render
    await waitFor(() => {
      expect(screen.getByText('4 events')).toBeInTheDocument();
    });

    // Check specific activity descriptions
    expect(screen.getByText(/created this task/i)).toBeInTheDocument();
    expect(screen.getByText(/changed status from/i)).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText(/assigned this task to/i)).toBeInTheDocument();
    expect(screen.getAllByText('Bob Smith')).toHaveLength(2);
    expect(screen.getByText(/commented/i)).toBeInTheDocument();
    expect(screen.getByText(/Working on it!/i)).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        error: { code: 'SERVER_ERROR', message: 'Internal error' },
      }, false, 500)
    );

    renderWithProviders(<TaskActivityTimeline taskId="task-123" />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load activity history/i)).toBeInTheDocument();
    });
  });
});
