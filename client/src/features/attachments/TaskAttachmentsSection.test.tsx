import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskAttachmentsSection } from './TaskAttachmentsSection';
import { renderWithProviders } from '@/test/test-utils';
import type { Attachment } from '@/types/api';

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

const mockUser = {
  id: 'user-1',
  name: 'Alice Walker',
  email: 'alice@example.com',
};

describe('TaskAttachmentsSection Component Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state when there are no attachments', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return mockJsonResponse({ user: mockUser });
      }
      if (urlStr.includes('/api/tasks/t-1/attachments')) {
        return mockJsonResponse({ attachments: [] });
      }
      return mockJsonResponse({});
    });

    renderWithProviders(<TaskAttachmentsSection taskId="t-1" />);

    expect(screen.getByRole('heading', { name: /^attachments$/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No attachments yet/i)).toBeInTheDocument();
    });
  });

  it('renders list of attachments with size, uploader, and download/delete controls', async () => {
    const mockAttachments: Attachment[] = [
      {
        id: 'att-1',
        taskId: 't-1',
        uploadedById: 'user-1',
        originalName: 'specs.pdf',
        storageKey: 'key-1',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 500, // ~500 KB
        createdAt: new Date().toISOString(),
        uploadedBy: { id: 'user-1', name: 'Alice Walker', email: 'alice@example.com' },
      },
      {
        id: 'att-2',
        taskId: 't-1',
        uploadedById: 'user-2',
        originalName: 'mockup.png',
        storageKey: 'key-2',
        mimeType: 'image/png',
        sizeBytes: 1024 * 1024 * 2, // 2 MB
        createdAt: new Date().toISOString(),
        uploadedBy: { id: 'user-2', name: 'Bob Smith', email: 'bob@example.com' },
      },
    ];

    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return mockJsonResponse({ user: mockUser });
      }
      if (urlStr.includes('/api/tasks/t-1/attachments')) {
        return mockJsonResponse({ attachments: mockAttachments });
      }
      return mockJsonResponse({});
    });

    renderWithProviders(
      <TaskAttachmentsSection taskId="t-1" isWorkspaceAdminOrOwner={true} />
    );

    await waitFor(() => {
      expect(screen.getByText('2 files')).toBeInTheDocument();
    });

    expect(screen.getByText('specs.pdf')).toBeInTheDocument();
    expect(screen.getByText('mockup.png')).toBeInTheDocument();
    expect(screen.getByText(/500 KB/i)).toBeInTheDocument();
    expect(screen.getByText(/2 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice Walker/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Smith/i)).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByLabelText('Download specs.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete specs.pdf')).toBeInTheDocument();
  });

  it('handles file download action via window.open', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const mockAttachments: Attachment[] = [
      {
        id: 'att-1',
        taskId: 't-1',
        uploadedById: 'user-1',
        originalName: 'design.png',
        storageKey: 'key-1',
        mimeType: 'image/png',
        sizeBytes: 1024 * 100,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return mockJsonResponse({ user: mockUser });
      }
      if (urlStr.includes('/api/tasks/t-1/attachments')) {
        return mockJsonResponse({ attachments: mockAttachments });
      }
      return mockJsonResponse({});
    });

    renderWithProviders(<TaskAttachmentsSection taskId="t-1" />);

    await waitFor(() => {
      expect(screen.getByText('design.png')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByLabelText('Download design.png');
    fireEvent.click(downloadBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith('/api/attachments/att-1/download', '_blank');
  });

  it('handles attachment deletion when delete button is clicked', async () => {
    const user = userEvent.setup();
    const mockAttachments: Attachment[] = [
      {
        id: 'att-to-delete',
        taskId: 't-1',
        uploadedById: 'user-1',
        originalName: 'old-notes.txt',
        storageKey: 'key-1',
        mimeType: 'text/plain',
        sizeBytes: 120,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(fetch).mockImplementation(async (url, config) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/auth/me')) {
        return mockJsonResponse({ user: mockUser });
      }
      if (urlStr.includes('/api/tasks/t-1/attachments')) {
        return mockJsonResponse({ attachments: mockAttachments });
      }
      if (urlStr.includes('/api/attachments/att-to-delete') && config?.method === 'DELETE') {
        return {
          ok: true,
          status: 204,
          headers: new Headers(),
          text: async () => '',
        } as unknown as Response;
      }
      return mockJsonResponse({});
    });

    renderWithProviders(
      <TaskAttachmentsSection taskId="t-1" isWorkspaceAdminOrOwner={true} />
    );

    await waitFor(() => {
      expect(screen.getByText('old-notes.txt')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Delete old-notes.txt');
    await user.click(deleteBtn);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/attachments/att-to-delete',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
