"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLocale, createTranslator, defaultLocale, getIntlLocale, localeCookieName } from "@/i18n";

type I18nContextValue = {
  locale: AppLocale;
  intlLocale: string;
  setLocale: (nextLocale: AppLocale) => void;
  t: ReturnType<typeof createTranslator>;
};

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  intlLocale: getIntlLocale(defaultLocale),
  setLocale: () => {},
  t: createTranslator(defaultLocale),
});

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: AppLocale;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);
  const router = useRouter();

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      intlLocale: getIntlLocale(locale),
      setLocale(nextLocale) {
        if (nextLocale === locale) {
          return;
        }

        document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
        setLocaleState(nextLocale);
        router.refresh();
      },
      t: createTranslator(locale),
    };
  }, [locale, router]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
