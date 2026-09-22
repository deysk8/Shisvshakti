'use client';

import { useI18n } from '@/lib/i18n';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={`text-xs text-gray-600 ${className}`}>
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as 'en' | 'or')}
        className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
      >
        <option value="en">{t('english')}</option>
        <option value="or">{t('odia')}</option>
      </select>
    </label>
  );
}
