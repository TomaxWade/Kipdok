"use client";

import { startTransition, useRef, useState } from "react";
import { LoaderCircle, RadioTower, TriangleAlert } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { formatLocaleDateTime, formatLocaleEventAction } from "@/i18n";
import type { DashboardEventEntry } from "@/lib/dashboard";
import { DASHBOARD_EVENTS_API_PATH } from "@/lib/routes";

export function RecentEventsCard({
  initialEvents,
  initialNextOffset,
  totalCount,
}: {
  initialEvents: DashboardEventEntry[];
  initialNextOffset: number | null;
  totalCount: number;
}) {
  const { locale, t } = useI18n();
  const [events, setEvents] = useState(initialEvents);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestedOffsets = useRef(new Set<number>());

  const loadedCount = events.length;
  const canLoadMore = nextOffset !== null && loadedCount < totalCount;

  async function loadMore() {
    if (nextOffset === null || isLoadingMore || requestedOffsets.current.has(nextOffset)) {
      return;
    }

    requestedOffsets.current.add(nextOffset);
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const response = await fetch(`${DASHBOARD_EVENTS_API_PATH}?offset=${nextOffset}&limit=10`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        events?: DashboardEventEntry[];
        nextOffset?: number | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? t("events.loadError"));
      }

      startTransition(() => {
        setEvents((current) => current.concat(data.events ?? []));
        setNextOffset(typeof data.nextOffset === "number" ? data.nextOffset : null);
      });
    } catch (error) {
      requestedOffsets.current.delete(nextOffset);
      setLoadError(error instanceof Error ? error.message : t("events.loadError"));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const eventList = events.map((event) => ({
    ...event,
    label: formatLocaleEventAction(event.action, locale),
    meta: `${formatLocaleDateTime(event.createdAt, locale)} · ${event.browserName ?? t("common.unknown")} / ${event.osName ?? t("common.unknown")}`,
  }));

  return (
    <section className="app-shell-card rounded-[1.75rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="app-kicker">{t("events.kicker")}</p>
          <h3 className="mt-3 text-lg font-semibold text-white">{t("events.title")}</h3>
          <p className="mt-1 text-xs text-slate-400">{t("events.description")}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
          {t("events.loadedCount", { loaded: loadedCount, total: totalCount })}
        </div>
      </div>

      <div
        className="mt-4 grid max-h-[28rem] gap-3 overflow-y-auto pr-1"
        onScroll={(event) => {
          const target = event.currentTarget;
          const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 48;
          if (nearBottom) {
            void loadMore();
          }
        }}
      >
        {eventList.length ? (
          eventList.map((event) => (
            <div key={event.id} className="rounded-[1.35rem] border border-white/10 bg-slate-950/50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-white">{event.label}</p>
                {event.sourceIp ? (
                  <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-400">{event.sourceIp}</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-400">{event.meta}</p>
              {event.detail ? <p className="mt-2 text-xs leading-6 text-slate-300">{event.detail}</p> : null}
              {event.tailscaleNode ? (
                <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-cyan-200/80">
                  <RadioTower className="size-3" />
                  <span>{event.tailscaleNode}</span>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-8 text-center text-sm text-slate-400">
            {t("events.empty")}
          </div>
        )}

        {isLoadingMore ? (
          <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
            <LoaderCircle className="size-4 animate-spin" />
            {t("events.loadingMore")}
          </div>
        ) : null}

        {loadError ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            <TriangleAlert className="size-4" />
            {loadError}
          </div>
        ) : null}

        {!canLoadMore && eventList.length ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-center text-xs text-slate-400">
            {t("events.end")}
          </div>
        ) : null}
      </div>
    </section>
  );
}
