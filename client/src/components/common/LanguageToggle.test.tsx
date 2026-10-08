import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageToggle } from './LanguageToggle';
import { LanguageProvider, useLanguage } from '@/lib/i18n/language-context';
import { renderWithProviders } from '@/test/test-utils';

function LanguageTestConsumer() {
  const { t } = useLanguage();
  return (
    <div>
      <LanguageToggle />
      <span data-testid="translated-text">{t('nav.projects')}</span>
      <span data-testid="interpolated-text">{t('projects.tasksCount', { count: 7 })}</span>
    </div>
  );
}

describe('LanguageToggle Component & i18n Switching Tests', () => {
  const STORAGE_KEY = 'agora-lang';

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders language toggle button with default EN label', () => {
    renderWithProviders(
      <LanguageProvider storageKey={STORAGE_KEY} defaultLanguage="en">
        <LanguageTestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByRole('button', { name: /change language, current: EN/i })).toBeInTheDocument();
    expect(screen.getByTestId('translated-text')).toHaveTextContent('Projects');
    expect(screen.getByTestId('interpolated-text')).toHaveTextContent('7 tasks');
  });

  it('opens language dropdown with English and Türkçe options when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LanguageProvider storageKey={STORAGE_KEY} defaultLanguage="en">
        <LanguageTestConsumer />
      </LanguageProvider>
    );

    const toggleButton = screen.getByRole('button', { name: /change language, current: EN/i });
    await user.click(toggleButton);

    expect(screen.getByRole('menu', { name: /language options/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /türkçe/i })).toBeInTheDocument();
  });

  it('switches to Turkish and updates UI text and document lang', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LanguageProvider storageKey={STORAGE_KEY} defaultLanguage="en">
        <LanguageTestConsumer />
      </LanguageProvider>
    );

    const toggleButton = screen.getByRole('button', { name: /change language, current: EN/i });
    await user.click(toggleButton);

    const trOption = screen.getByRole('menuitem', { name: /türkçe/i });
    await user.click(trOption);

    // Verifies language updated to Turkish
    expect(screen.getByTestId('translated-text')).toHaveTextContent('Projeler');
    expect(screen.getByTestId('interpolated-text')).toHaveTextContent('7 görev');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('tr');
    expect(document.documentElement.lang).toBe('tr');
  });

  it('switches back to English from Turkish', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, 'tr');

    renderWithProviders(
      <LanguageProvider storageKey={STORAGE_KEY} defaultLanguage="tr">
        <LanguageTestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('translated-text')).toHaveTextContent('Projeler');

    const toggleButton = screen.getByRole('button', { name: /change language, current: TR/i });
    await user.click(toggleButton);

    const enOption = screen.getByRole('menuitem', { name: /english/i });
    await user.click(enOption);

    expect(screen.getByTestId('translated-text')).toHaveTextContent('Projects');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('closes dropdown when Escape key is pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LanguageProvider storageKey={STORAGE_KEY} defaultLanguage="en">
        <LanguageTestConsumer />
      </LanguageProvider>
    );

    const toggleButton = screen.getByRole('button', { name: /change language, current: EN/i });
    await user.click(toggleButton);

    expect(screen.getByRole('menu', { name: /language options/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: /language options/i })).not.toBeInTheDocument();
  });
});
