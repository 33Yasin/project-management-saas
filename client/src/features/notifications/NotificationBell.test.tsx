import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from './NotificationBell';
import { renderWithProviders } from '@/test/test-utils';
import type { Notification } from '@/types/api';

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

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'u-1',
    workspaceId: 'ws-1',
    type: 'TASK_ASSIGNED',
    title: 'Task Assigned',
    message: 'Alice assigned you to Fix header',
    entityType: 'TASK',
    entityId: 't-1',
    readAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    userId: 'u-1',
    workspaceId: 'ws-1',
    type: 'COMMENT_ADDED',
    title: 'New Comment',
    message: 'Bob commented on Fix header',
    entityType: 'TASK',
    entityId: 't-1',
    readAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

describe('NotificationBell Component Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders bell button with unread count badge', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/notifications')) {
        return mockJsonResponse({
          items: mockNotifications,
          unreadCount: 1,
          pagination: { page: 1, limit: 30, totalItems: 2, totalPages: 1 },
        });
      }
      return mockJsonResponse({});
    });

    renderWithProviders(<NotificationBell />);

    const bellBtn = screen.getByLabelText(/Open notifications/i);
    expect(bellBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('opens dropdown menu and lists notifications when clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/notifications')) {
        return mockJsonResponse({
          items: mockNotifications,
          unreadCount: 1,
          pagination: { page: 1, limit: 30, totalItems: 2, totalPages: 1 },
        });
      }
      return mockJsonResponse({});
    });

    renderWithProviders(<NotificationBell />);

    const bellBtn = screen.getByLabelText(/Open notifications/i);
    await user.click(bellBtn);

    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(screen.getByText('Task Assigned')).toBeInTheDocument();
    expect(screen.getByText('Alice assigned you to Fix header')).toBeInTheDocument();
    expect(screen.getByText('Bob commented on Fix header')).toBeInTheDocument();
  });

  it('calls markAllAsRead endpoint when clicking "Mark all read"', async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockImplementation(async (url, config) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/notifications/read-all') && config?.method === 'POST') {
        return mockJsonResponse({ count: 1 });
      }
      if (urlStr.includes('/api/notifications')) {
        return mockJsonResponse({
          items: mockNotifications,
          unreadCount: 1,
          pagination: { page: 1, limit: 30, totalItems: 2, totalPages: 1 },
        });
      }
      return mockJsonResponse({});
    });

    renderWithProviders(<NotificationBell />);

    // Open dropdown
    const bellBtn = screen.getByLabelText(/Open notifications/i);
    await user.click(bellBtn);

    const markAllBtn = screen.getByRole('button', { name: /Mark all read/i });
    await user.click(markAllBtn);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/notifications/read-all',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('marks a notification as read and closes dropdown when clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockImplementation(async (url, config) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/notifications/notif-1/read') && config?.method === 'PATCH') {
        return mockJsonResponse({
          notification: { ...mockNotifications[0], readAt: new Date().toISOString() },
        });
      }
      if (urlStr.includes('/api/notifications')) {
        return mockJsonResponse({
          items: mockNotifications,
          unreadCount: 1,
          pagination: { page: 1, limit: 30, totalItems: 2, totalPages: 1 },
        });
      }
      return mockJsonResponse({});
    });

    renderWithProviders(<NotificationBell />);

    const bellBtn = screen.getByLabelText(/Open notifications/i);
    await user.click(bellBtn);

    const notifItem = screen.getByText('Alice assigned you to Fix header');
    await user.click(notifItem);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/notifications/notif-1/read',
      expect.objectContaining({ method: 'PATCH' })
    );
  });
});
