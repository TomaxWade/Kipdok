import en from "@/i18n/messages/en";
import zh from "@/i18n/messages/zh";

export const locales = ["zh", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "zh";
export const localeCookieName = "kipdok-locale";

const messages = {
  zh,
  en,
} as const;

type MessageKey = keyof typeof zh;
type TranslationVars = Record<string, number | string>;

export function isLocale(value: string | null | undefined): value is AppLocale {
  return value === "zh" || value === "en";
}

export function getIntlLocale(locale: AppLocale) {
  return locale === "zh" ? "zh-CN" : "en-US";
}

function interpolate(template: string, vars?: TranslationVars) {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export function translate(locale: AppLocale, key: MessageKey | string, vars?: TranslationVars, fallback?: string) {
  const template =
    (messages[locale] as Record<string, string>)[key] ??
    (messages[defaultLocale] as Record<string, string>)[key] ??
    fallback ??
    key;

  return interpolate(template, vars);
}

export function createTranslator(locale: AppLocale) {
  return (key: MessageKey | string, vars?: TranslationVars, fallback?: string) => translate(locale, key, vars, fallback);
}

export function formatLocaleDateTime(value: string | Date, locale: AppLocale) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatLocaleDate(
  value: string | Date,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions,
) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(date);
}

export function formatLocaleEventAction(action: string, locale: AppLocale) {
  return translate(locale, `event.${action}`, undefined, action);
}
