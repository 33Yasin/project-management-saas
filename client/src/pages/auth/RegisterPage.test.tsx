import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './RegisterPage';
import { renderWithProviders } from '@/test/test-utils';

describe('RegisterPage Integration Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders registration form elements correctly', () => {
    renderWithProviders(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates minimum name length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/^email$/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /^create account$/i });

    await user.type(nameInput, 'A');
    await user.type(emailInput, 'valid@example.com');
    await user.type(passwordInput, 'ValidPass1');
    await user.click(submitButton);

    expect(await screen.findByText(/name must be at least 2 characters/i)).toBeInTheDocument();
  });

  it('validates password complexity (requires uppercase and number)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/^email$/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /^create account$/i });

    await user.type(nameInput, 'Alice Doe');
    await user.type(emailInput, 'alice@example.com');
    await user.type(passwordInput, 'lowercaseonly1');
    await user.click(submitButton);

    expect(
      await screen.findByText(/password must contain at least one uppercase letter/i)
    ).toBeInTheDocument();
  });

  it('handles successful registration by sending payload to API', async () => {
    const user = userEvent.setup();
    const mockUser = {
      id: 'u-2',
      name: 'Bob Smith',
      email: 'bob@example.com',
      createdAt: new Date().toISOString(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ user: mockUser }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/full name/i), 'Bob Smith');
    await user.type(screen.getByLabelText(/^email$/i), 'bob@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Bob Smith',
            email: 'bob@example.com',
            password: 'SecurePass123',
          }),
        })
      );
    });
  });

  it('displays error message when registration fails on the server', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'CONFLICT',
          message: 'An account with this email address already exists.',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/full name/i), 'Existing User');
    await user.type(screen.getByLabelText(/^email$/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(
      await screen.findByText(/an account with this email address already exists/i)
    ).toBeInTheDocument();
  });
});
