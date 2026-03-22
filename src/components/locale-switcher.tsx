"use client";

import { useI18n } from "@/components/i18n-provider";
import { AppLocale } from "@/i18n";
import { cn } from "@/lib/utils";

const localeOrder: AppLocale[] = ["zh", "en"];

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1" aria-label={t("locale.label")}>
      {localeOrder.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            locale === option
              ? "bg-[var(--accent-primary)] text-slate-950"
              : "text-slate-300 hover:bg-white/8 hover:text-white",
          )}
        >
          {t(`locale.switch.${option}`)}
        </button>
      ))}
    </div>
  );
}
