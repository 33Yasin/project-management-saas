import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { renderWithProviders } from '@/test/test-utils';

describe('ProtectedRoute Integration Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading spinner while authenticating session', () => {
    // Return a never-resolving promise to test loading state
    vi.stubGlobal('fetch', () => new Promise(() => {}));

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected Dashboard</div>} />
        </Route>
      </Routes>,
      { initialEntries: ['/dashboard'] }
    );

    expect(screen.getByText(/authenticating session/i)).toBeInTheDocument();
  });

  it('redirects to /login when user is unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
        }),
      })
    );

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected Dashboard</div>} />
        </Route>
        <Route path="/login" element={<div>Login Destination Page</div>} />
      </Routes>,
      { initialEntries: ['/dashboard'] }
    );

    expect(await screen.findByText(/login destination page/i)).toBeInTheDocument();
    expect(screen.queryByText(/protected dashboard/i)).not.toBeInTheDocument();
  });

  it('renders protected child route when user session is active', async () => {
    const mockUser = {
      id: 'u-1',
      name: 'Active User',
      email: 'user@example.com',
      createdAt: new Date().toISOString(),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ user: mockUser }),
      })
    );

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
        </Route>
      </Routes>,
      { initialEntries: ['/dashboard'] }
    );

    expect(await screen.findByText(/protected dashboard content/i)).toBeInTheDocument();
  });
});
