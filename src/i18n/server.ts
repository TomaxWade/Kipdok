import "server-only";

import { cookies, headers } from "next/headers";
import { AppLocale, createTranslator, defaultLocale, isLocale, localeCookieName } from "@/i18n";

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;

  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";

  if (acceptLanguage.toLowerCase().includes("en")) {
    return "en";
  }

  return defaultLocale;
}

export async function getRequestTranslator() {
  const locale = await getRequestLocale();
  return createTranslator(locale);
}
