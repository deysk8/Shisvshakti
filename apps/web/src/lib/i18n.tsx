'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, or, type LocaleKey } from '@/locales/messages';

type Locale = 'en' | 'or';

const STORAGE_KEY = 'shivasakti-locale';

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: LocaleKey) => string;
} | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === 'en' || stored === 'or') setLocaleState(stored);
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === 'or' ? 'or' : 'en';
  }

  const t = useMemo(() => {
    const dict = locale === 'or' ? or : en;
    return (key: LocaleKey) => dict[key] ?? en[key];
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
