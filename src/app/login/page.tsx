"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { INBOX_ROUTE, LOGIN_API_PATH } from "@/lib/routes";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(LOGIN_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      let data: { error?: string } = {};
      try {
        data = (await response.json()) as { error?: string };
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(data.error ?? t("login.error.invalid"));
        return;
      }

      setSuccess(t("login.success"));
      router.replace(INBOX_ROUTE);
      router.refresh();
    } catch {
      setError(t("login.error.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="app-shell-card w-full max-w-[560px] rounded-[2.3rem] p-6 sm:p-8">
        <div className="rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(102,219,200,0.16),_rgba(8,18,31,0.96)_72%)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(102,219,200,0.16)] bg-[rgba(102,219,200,0.08)] px-4 py-2 text-sm text-cyan-50">
              <ShieldCheck className="size-4 text-[var(--accent-primary)]" />
              {t("login.badge")}
            </div>
            <LocaleSwitcher />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t("login.title")}</h1>
          <p className="mt-3 text-sm text-cyan-100/90">{t("brand.subtitle")}</p>
          <p className="mt-2 text-sm leading-7 text-slate-300">{t("login.description")}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="app-chip">{t("login.tailnet")}</span>
            <span className="app-chip">{t("login.local")}</span>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm text-slate-200">
            {t("login.username")}
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-12 rounded-[1.2rem] border border-white/10 bg-white/6 px-4 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/60"
              placeholder={t("login.usernamePlaceholder")}
              autoComplete="username"
            />
          </label>
          <p className="-mt-1 text-xs leading-6 text-slate-400">{t("login.usernameHint")}</p>

          <label className="grid gap-2 text-sm text-slate-200">
            {t("login.password")}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-[1.2rem] border border-white/10 bg-white/6 px-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              placeholder={t("login.passwordPlaceholder")}
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="rounded-[1.2rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
          {success ? (
            <div className="flex items-center gap-2 rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{success}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-12 items-center justify-center rounded-[1.2rem] bg-[var(--accent-primary)] px-4 font-medium text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
