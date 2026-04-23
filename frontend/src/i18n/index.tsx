import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale } from 'antd/es/locale';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';

export type AppLocale = 'zh-CN' | 'en-US';

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  antdLocale: Locale;
  isEnglish: boolean;
}

const STORAGE_KEY = 'paper-format-compliance-checker-locale';

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const readStoredLocale = (): AppLocale => {
  if (typeof window === 'undefined') {
    return 'zh-CN';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'en-US' ? 'en-US' : 'zh-CN';
};

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocale] = useState<AppLocale>(() => readStoredLocale());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    antdLocale: locale === 'en-US' ? enUS : zhCN,
    isEnglish: locale === 'en-US',
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider.');
  }

  return context;
};
