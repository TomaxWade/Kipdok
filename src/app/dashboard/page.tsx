import { AppShell } from "@/components/app-shell";
import { StoragePieChart, TimelineChart, TrendChart } from "@/components/charts";
import { NetworkProfileCard } from "@/components/network-profile-card";
import { RecentEventsCard } from "@/components/recent-events-card";
import { createTranslator, formatLocaleDate } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getDashboardSummary, getRecentEventsPage, getStorageBreakdown, getTimeline, getTrendSeries } from "@/lib/dashboard";
import { requireSession } from "@/lib/auth";
import { getNetworkProfileStatus } from "@/lib/network-profile";
import { formatBytes } from "@/lib/utils";

type TrendTimelineEntry = Awaited<ReturnType<typeof getTimeline>>[number];
type ExtensionBreakdownEntry = Awaited<ReturnType<typeof getDashboardSummary>>["byExtension"][number];

export default async function DashboardPage() {
  await requireSession();
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const [summary, trends, storage, timeline, recentEventsPage, networkProfile] = await Promise.all([
    getDashboardSummary(),
    getTrendSeries(),
    getStorageBreakdown(),
    getTimeline(24),
    getRecentEventsPage(0, 10),
    getNetworkProfileStatus(),
  ]);

  return (
    <AppShell
      title={t("page.dashboard.title")}
      subtitle={t("page.dashboard.subtitle")}
    >
      <div className="mb-6">
        <NetworkProfileCard initialStatus={networkProfile} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("dashboard.totalMessages"), value: summary.messageCount, note: t("dashboard.totalMessagesNote") },
          { label: t("dashboard.totalFiles"), value: summary.fileCount, note: t("dashboard.totalFilesNote") },
          { label: t("dashboard.totalBytes"), value: formatBytes(summary.totalBytes), note: t("dashboard.totalBytesNote") },
          { label: t("dashboard.totalEvents"), value: summary.totalEventCount, note: t("dashboard.totalEventsNote") },
        ].map((card) => (
          <section key={card.label} className="app-shell-card rounded-[1.75rem] p-5">
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className="app-stat-value mt-3 text-3xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.note}</p>
          </section>
        ))}
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <TrendChart data={trends} />
        <section className="app-shell-card rounded-[1.85rem] p-6">
          <p className="app-kicker">{t("dashboard.fileMixKicker")}</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{t("dashboard.fileMixTitle")}</h3>

          <div className="mt-5 grid gap-3">
            {summary.byExtension.length ? (
              summary.byExtension.slice(0, 6).map((entry: ExtensionBreakdownEntry, index: number) => (
                <div key={entry.extension} className="flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-xs text-slate-300">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm text-white">.{entry.extension}</p>
                      <p className="text-xs text-slate-400">{t("dashboard.fileMixCount", { count: entry.count })}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-200">{formatBytes(entry.sizeBytes)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-slate-950/45 px-4 py-10 text-center text-sm text-slate-400">
                {t("dashboard.fileMixEmpty")}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TimelineChart
          data={timeline
            .slice()
            .reverse()
            .map((event: TrendTimelineEntry, index: number) => ({
              createdAt: formatLocaleDate(event.createdAt, locale, {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }),
              score: index + 1,
            }))}
        />
      </div>

      <div className="mt-6">
        <StoragePieChart data={storage} />
      </div>

      <div className="mt-6">
        <RecentEventsCard
          initialEvents={recentEventsPage.events}
          initialNextOffset={recentEventsPage.nextOffset}
          totalCount={recentEventsPage.totalCount}
        />
      </div>
    </AppShell>
  );
}
