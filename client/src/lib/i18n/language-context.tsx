/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { en } from './translations/en';
import { tr } from './translations/tr';
import type { Language, TranslationKey, TranslationParams } from './types';

const dictionaries = { en, tr };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  defaultLanguage = 'en',
  storageKey = 'agora-lang',
}: {
  children: React.ReactNode;
  defaultLanguage?: Language;
  storageKey?: string;
}) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(storageKey) as Language | null;
      if (saved === 'en' || saved === 'tr') return saved;
      // Default to navigator language if starts with tr
      if (typeof navigator !== 'undefined' && navigator.language?.startsWith('tr')) {
        return 'tr';
      }
    } catch {
      // Fallback
    }
    return defaultLanguage;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, language);
      document.documentElement.lang = language;
    } catch {
      // localStorage may fail in restricted iframes
    }
  }, [language, storageKey]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'tr' : 'en'));
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams): string => {
      const keys = (key as string).split('.');
      let current: unknown = dictionaries[language];
      let fallback: unknown = dictionaries.en;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = (current as Record<string, unknown>)[k];
        } else {
          current = undefined;
        }

        if (fallback && typeof fallback === 'object' && k in fallback) {
          fallback = (fallback as Record<string, unknown>)[k];
        } else {
          fallback = undefined;
        }
      }

      let text = typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : key;

      if (params && typeof text === 'string') {
        for (const [pKey, pVal] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        }
      }

      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
