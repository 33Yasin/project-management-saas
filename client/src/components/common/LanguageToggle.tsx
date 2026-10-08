import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';
import type { Language } from '@/lib/i18n/types';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const options: { value: Language; label: string; short: string; flag: string }[] = [
    { value: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
    { value: 'tr', label: 'Türkçe', short: 'TR', flag: '🇹🇷' },
  ];

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Change language, current: ${language.toUpperCase()}`}
        title={`Change language (${language.toUpperCase()})`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          'h-8 px-2.5 rounded-lg border border-border bg-card text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors cursor-pointer shrink-0 text-xs font-semibold',
          className
        )}
      >
        <Globe className="size-3.5 text-muted-foreground" />
        <span>{language.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Language options"
          className="absolute right-0 mt-2 w-36 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 p-1 space-y-0.5 animate-in fade-in-50 slide-in-from-top-2"
        >
          {options.map((opt) => {
            const isSelected = language === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setLanguage(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{opt.flag}</span>
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
