import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { renderWithProviders } from '@/test/test-utils';

describe('LoginPage Integration Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login form elements correctly', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument();
  });

  it('displays validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText(/^email$/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const form = screen.getByRole('button', { name: /^sign in$/i }).closest('form')!;

    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'secret123');
    fireEvent.submit(form);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('displays validation error for empty password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText(/^email$/i);
    const submitButton = screen.getByRole('button', { name: /^sign in$/i });

    await user.type(emailInput, 'user@example.com');
    await user.click(submitButton);

    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('handles successful login by submitting credentials to the API', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u-1',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ user: mockUser }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/^email$/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'john@example.com', password: 'password123' }),
        })
      );
    });
  });

  it('displays server error message when authentication fails', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/^email$/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});
