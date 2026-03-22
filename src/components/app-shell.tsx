"use client";

import { useEffect, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Inbox, LoaderCircle, LogOut, Send, Shield } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { DASHBOARD_ROUTE, INBOX_ROUTE, LOGOUT_API_PATH, UPLOAD_ROUTE } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activePendingHref = pendingHref === pathname ? null : pendingHref;
  const links = [
    { href: INBOX_ROUTE, label: t("nav.inbox"), icon: Inbox },
    { href: UPLOAD_ROUTE, label: t("nav.upload"), icon: Send },
    { href: DASHBOARD_ROUTE, label: t("nav.dashboard"), icon: BarChart3 },
  ];

  useEffect(() => {
    router.prefetch(INBOX_ROUTE);
    router.prefetch(UPLOAD_ROUTE);
    router.prefetch(DASHBOARD_ROUTE);
  }, [router]);

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      href === pathname
    ) {
      return;
    }

    event.preventDefault();
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1560px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[290px_minmax(0,1fr)] xl:px-8">
        <aside className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div className="app-shell-card app-grid-pattern flex h-full flex-col rounded-[2rem] p-4 sm:p-5">
            <div className="rounded-[1.7rem] border border-[rgba(102,219,200,0.14)] bg-[radial-gradient(circle_at_top,_rgba(102,219,200,0.16),_rgba(8,18,31,0.96)_70%)] p-3.5">
              <div className="flex items-center gap-3">
                <div className="rounded-[1.2rem] border border-white/10 bg-white/8 p-3 text-[var(--accent-primary)]">
                  <Shield className="size-6" />
                </div>
                <div className="min-w-0">
                  <p className="app-kicker">{t("brand.secureRelay")}</p>
                  <h1 className="mt-2 text-xl font-semibold text-white">{t("brand.lockup")}</h1>
                  <p className="mt-2 text-sm text-slate-300">{t("brand.subtitle")}</p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="app-kicker">{t("brand.workspace")}</p>
                <LocaleSwitcher />
              </div>
              <nav className="mt-2.5 grid gap-2">
                {links.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  const pending = activePendingHref === href && !active;

                  return (
                    <Link
                      key={href}
                      href={href}
                      prefetch
                      onMouseEnter={() => router.prefetch(href)}
                      onFocus={() => router.prefetch(href)}
                      onClick={(event) => handleNavClick(event, href)}
                      aria-current={active ? "page" : undefined}
                      aria-busy={pending || undefined}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-[1.35rem] px-4 py-3 text-sm transition duration-200 ease-out active:scale-[0.98]",
                        active
                          ? "border border-[rgba(102,219,200,0.26)] bg-[rgba(102,219,200,0.14)] text-white shadow-lg shadow-cyan-950/20"
                          : pending
                            ? "border border-[rgba(102,219,200,0.22)] bg-[rgba(102,219,200,0.1)] text-cyan-50"
                            : "border border-transparent bg-white/0 text-slate-300 hover:border-white/8 hover:bg-white/6 hover:text-white",
                      )}
                    >
                      <Icon className={cn("size-4", pending && "animate-pulse")} />
                      <span className="flex-1">{label}</span>
                      {pending ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-cyan-50/90">
                          <LoaderCircle className="size-3 animate-spin" />
                          {t("action.switching")}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <form action={LOGOUT_API_PATH} method="post" className="mt-auto pt-4">
              <button
                type="submit"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[1.35rem] border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
              >
                <LogOut className="size-4" />
                {t("action.logout")}
              </button>
            </form>
          </div>
        </aside>

        <main
          aria-busy={(isPending && Boolean(activePendingHref)) || undefined}
          className={cn(
            "app-shell-card flex-1 rounded-[2rem] p-5 transition sm:p-6",
            activePendingHref && "ring-1 ring-[rgba(102,219,200,0.24)]",
          )}
        >
          <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="app-kicker">{t("brand.console")}</p>
              <h2 className="mt-2 text-[1.85rem] font-semibold tracking-tight text-white sm:text-[2.2rem]">{title}</h2>
              {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{subtitle}</p> : null}
              {activePendingHref ? (
                <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(102,219,200,0.2)] bg-[rgba(102,219,200,0.1)] px-3 py-1 text-xs text-cyan-50">
                  <LoaderCircle className="size-3 animate-spin" />
                  {t("action.loadingPage")}
                </div>
              ) : null}
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
