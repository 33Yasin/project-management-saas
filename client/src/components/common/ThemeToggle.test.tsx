import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { renderWithProviders } from '@/test/test-utils';

describe('ThemeToggle Component & Theme Switching Tests', () => {
  const STORAGE_KEY = 'vite-ui-theme';

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');

    // Default mock for matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, // light by default
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');
    vi.restoreAllMocks();
  });

  it('renders theme button and displays current theme label', () => {
    renderWithProviders(<ThemeToggle />);

    const button = screen.getByRole('button', { name: /current theme: light/i });
    expect(button).toBeInTheDocument();
  });

  it('opens theme selection dropdown with Light, Dark, and System options when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    const toggleButton = screen.getByRole('button', { name: /current theme: light/i });
    await user.click(toggleButton);

    expect(screen.getByRole('menu', { name: /theme options/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^light/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^dark/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^system/i })).toBeInTheDocument();
  });

  it('switches to dark mode and adds dark class to document root', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    const toggleButton = screen.getByRole('button', { name: /current theme/i });
    await user.click(toggleButton);

    const darkModeOption = screen.getByRole('menuitem', { name: /^dark/i });
    await user.click(darkModeOption);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('switches from dark to light mode and updates document root classes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    // 1. Switch to dark first
    const toggleButton = screen.getByRole('button', { name: /current theme/i });
    await user.click(toggleButton);
    const darkModeOption = screen.getByRole('menuitem', { name: /^dark/i });
    await user.click(darkModeOption);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // 2. Open menu again and switch to light
    await user.click(toggleButton);
    const lightModeOption = screen.getByRole('menuitem', { name: /^light/i });
    await user.click(lightModeOption);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('switches to system mode and persists system choice in localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    const toggleButton = screen.getByRole('button', { name: /current theme/i });
    await user.click(toggleButton);

    const systemOption = screen.getByRole('menuitem', { name: /^system/i });
    await user.click(systemOption);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
  });

  it('closes dropdown when Escape key is pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    const toggleButton = screen.getByRole('button', { name: /current theme/i });
    await user.click(toggleButton);

    expect(screen.getByRole('menu', { name: /theme options/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: /theme options/i })).not.toBeInTheDocument();
  });
});
