'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { type Language, getSavedLanguage, saveLanguage, translations } from './translations';

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoaded: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'mr',
  setLang: () => {},
  t: (key: string) => key,
  isLoaded: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('mr');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = getSavedLanguage();
    setLangState(saved);
    setIsLoaded(true);
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    saveLanguage(newLang);
    document.documentElement.lang = newLang;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = translations[lang];
      let val = dict?.[key];
      if (val === undefined) {
        val = translations['en']?.[key];
      }
      if (val === undefined) return key;
      if (!params) return val;
      return val.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`));
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isLoaded }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
