"use client";

import { useState, useTransition } from "react";
import { CalendarRange, CheckCheck, Layers3, LayoutList, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { InboxRefreshButton } from "@/components/inbox-refresh-button";
import { FileBubble, MessageBubble, type InboxItem } from "@/components/message-bubble";
import { TransferStatusCard } from "@/components/transfer-status-card";
import { formatLocaleDate } from "@/i18n";
import { INBOX_ROUTE, ITEMS_API_PATH } from "@/lib/routes";
import { cn, formatBytes } from "@/lib/utils";

type InboxFilterType = "all" | "message" | "file";
type InboxRangeType = "all" | "today" | "7d" | "30d" | "custom";
type InboxViewType = "date" | "flat";

type InboxFilters = {
  type: InboxFilterType;
  q: string;
  range: InboxRangeType;
  from: string;
  to: string;
  view: InboxViewType;
};

type InboxBoardProps = {
  initialItems: InboxItem[];
  initialFilters: InboxFilters;
};

type InboxGroup = {
  key: string;
  label: string;
  itemCount: number;
  messageCount: number;
  fileCount: number;
  items: InboxItem[];
};

type Translator = ReturnType<typeof useI18n>["t"];

function getDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateLabel(value: string, locale: "zh" | "en") {
  return formatLocaleDate(value, locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function getRangeLabel(range: InboxRangeType, from: string, to: string, t: Translator) {
  if (range === "today") return t("inbox.range.label.today");
  if (range === "7d") return t("inbox.range.label.7d");
  if (range === "30d") return t("inbox.range.label.30d");
  if (range === "custom") {
    if (from && to) return t("inbox.range.label.between", { from, to });
    if (from) return t("inbox.range.label.from", { from });
    if (to) return t("inbox.range.label.to", { to });
    return t("inbox.range.label.custom");
  }
  return t("inbox.range.label.all");
}

function groupItemsByDate(items: InboxItem[], locale: "zh" | "en") {
  const groups = new Map<string, InboxGroup>();

  for (const item of items) {
    const key = getDateKey(item.createdAt);
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      existing.itemCount += 1;
      if (item.type === "message") {
        existing.messageCount += 1;
      } else {
        existing.fileCount += 1;
      }
      continue;
    }

    groups.set(key, {
      key,
      label: getDateLabel(item.createdAt, locale),
      itemCount: 1,
      messageCount: item.type === "message" ? 1 : 0,
      fileCount: item.type === "file" ? 1 : 0,
      items: [item],
    });
  }

  return Array.from(groups.values());
}

export function InboxBoard({ initialItems, initialFilters }: InboxBoardProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [isRouting, startRouting] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [draftType, setDraftType] = useState<InboxFilterType>(initialFilters.type);
  const [draftQuery, setDraftQuery] = useState(initialFilters.q);
  const [draftRange, setDraftRange] = useState<InboxRangeType>(initialFilters.range);
  const [draftFrom, setDraftFrom] = useState(initialFilters.from);
  const [draftTo, setDraftTo] = useState(initialFilters.to);
  const [viewMode, setViewMode] = useState<InboxViewType>(initialFilters.view);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredMessageCount = initialItems.filter((item) => item.type === "message").length;
  const filteredFileCount = initialItems.filter((item) => item.type === "file").length;
  const filteredBytes = initialItems.reduce((sum, item) => sum + (item.fileSize ?? 0), 0);
  const hasFilters =
    initialFilters.type !== "all" ||
    Boolean(initialFilters.q) ||
    initialFilters.range !== "all" ||
    Boolean(initialFilters.from) ||
    Boolean(initialFilters.to);
  const groupedItems = groupItemsByDate(initialItems, locale);
  const selectedCount = selectedIds.length;
  const allVisibleSelected = initialItems.length > 0 && selectedCount === initialItems.length;

  function buildInboxHref(next: InboxFilters) {
    const params = new URLSearchParams();

    if (next.type !== "all") {
      params.set("type", next.type);
    }

    const query = next.q.trim();
    if (query) {
      params.set("q", query);
    }

    if (next.range !== "all") {
      params.set("range", next.range);
    }

    if (next.range === "custom") {
      if (next.from) {
        params.set("from", next.from);
      }

      if (next.to) {
        params.set("to", next.to);
      }
    }

    if (next.view !== "date") {
      params.set("view", next.view);
    }

    const queryString = params.toString();
    return `${INBOX_ROUTE}${queryString ? `?${queryString}` : ""}`;
  }

  function applyFilters(nextFilters?: Partial<InboxFilters>) {
    const next: InboxFilters = {
      type: draftType,
      q: draftQuery,
      range: draftRange,
      from: draftFrom,
      to: draftTo,
      view: viewMode,
      ...nextFilters,
    };

    startRouting(() => {
      router.push(buildInboxHref(next));
    });
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => {
      if (current) {
        setSelectedIds([]);
      }
      return !current;
    });
  }

  function toggleItemSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(initialItems.map((item) => item.id));
  }

  async function deleteSelected() {
    if (!selectedIds.length) {
      return;
    }

    const confirmed = window.confirm(t("inbox.selection.confirm", { count: String(selectedIds.length) }));
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(ITEMS_API_PATH, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        window.alert(data.error ?? t("inbox.selection.delete"));
        return;
      }

      setSelectionMode(false);
      setSelectedIds([]);
      startDeleting(() => {
        router.refresh();
      });
    } catch {
      window.alert(t("inbox.selection.delete"));
    }
  }

  function renderItem(item: InboxItem) {
    const selected = selectedIds.includes(item.id);
    const commonProps = {
      item,
      selectionMode,
      selected,
      onToggleSelect: () => toggleItemSelection(item.id),
    };

    return item.type === "message" ? <MessageBubble key={item.id} {...commonProps} /> : <FileBubble key={item.id} {...commonProps} />;
  }

  return (
    <>
      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="app-shell-card rounded-[1.8rem] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="app-kicker">{t("inbox.filtersKicker")}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{t("inbox.filtersTitle")}</h3>
            </div>
            <div className="flex items-start justify-end">
              <InboxRefreshButton />
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-[1.45rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-3.5">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: t("inbox.type.all") },
                { key: "message", label: t("inbox.type.message") },
                { key: "file", label: t("inbox.type.file") },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDraftType(option.key as InboxFilterType)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    draftType === option.key
                      ? "bg-[var(--accent-primary)] text-slate-950"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <input
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder={t("inbox.searchPlaceholder")}
                className="h-11 rounded-[1.2rem] border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              />
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => applyFilters()}
                  disabled={isRouting}
                  className="inline-flex min-h-11 items-center justify-center rounded-[1.2rem] bg-[var(--accent-primary)] px-4 text-sm font-medium text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("inbox.applyFilters")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftType("all");
                    setDraftQuery("");
                    setDraftRange("all");
                    setDraftFrom("");
                    setDraftTo("");
                    setViewMode("date");
                    startRouting(() => {
                      router.push(INBOX_ROUTE);
                    });
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  {t("inbox.resetFilters")}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: t("inbox.range.all") },
                { key: "today", label: t("inbox.range.today") },
                { key: "7d", label: t("inbox.range.7d") },
                { key: "30d", label: t("inbox.range.30d") },
                { key: "custom", label: t("inbox.range.custom") },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDraftRange(option.key as InboxRangeType)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                    draftRange === option.key
                      ? "bg-cyan-300/14 text-cyan-50 ring-1 ring-cyan-300/35"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                  )}
                >
                  <CalendarRange className="size-4" />
                  {option.label}
                </button>
              ))}
            </div>

            {draftRange === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-200">
                  {t("inbox.range.from")}
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(event) => setDraftFrom(event.target.value)}
                    className="h-11 rounded-[1.2rem] border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none focus:border-cyan-300/60"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-200">
                  {t("inbox.range.to")}
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(event) => setDraftTo(event.target.value)}
                    className="h-11 rounded-[1.2rem] border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none focus:border-cyan-300/60"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </section>

        <section className="app-shell-card rounded-[1.8rem] p-4">
          <p className="app-kicker">{t("inbox.snapshotKicker")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: t("inbox.snapshot.results"), value: initialItems.length.toString(), note: hasFilters ? t("inbox.snapshot.filtered") : t("inbox.snapshot.allRecords") },
              { label: t("inbox.snapshot.messages"), value: filteredMessageCount.toString(), note: t("inbox.snapshot.messagesNote") },
              { label: t("inbox.snapshot.files"), value: filteredFileCount.toString(), note: t("inbox.snapshot.filesNote") },
              { label: t("inbox.snapshot.volume"), value: formatBytes(filteredBytes), note: getRangeLabel(initialFilters.range, initialFilters.from, initialFilters.to, t) },
            ].map((card) => (
              <div key={card.label} className="rounded-[1.35rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-3.5">
                <p className="text-xs text-slate-400">{card.label}</p>
                <p className="app-stat-value mt-2 text-xl font-semibold text-white">{card.value}</p>
                <p className="mt-1.5 text-xs text-slate-500">{card.note}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mb-6">
        <TransferStatusCard />
      </div>

      {initialItems.length ? (
        <section className="mb-5 app-shell-card rounded-[1.75rem] p-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setViewMode((current) => (current === "date" ? "flat" : "date"))}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10"
              >
                {viewMode === "date" ? <LayoutList className="size-4" /> : <Layers3 className="size-4" />}
                {viewMode === "date" ? t("inbox.view.flat") : t("inbox.view.date")}
              </button>

              <button
                type="button"
                onClick={toggleSelectionMode}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[1.2rem] px-4 text-sm transition",
                  selectionMode
                    ? "bg-cyan-300/14 text-cyan-50 ring-1 ring-cyan-300/35"
                    : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                )}
              >
                <CheckCheck className="size-4" />
                {selectionMode ? t("inbox.selection.exit") : t("inbox.selection.enter")}
              </button>
            </div>

            {selectionMode ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-200">
                  {t("inbox.selection.count", { selected: String(selectedCount), total: String(initialItems.length) })}
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <CheckCheck className="size-4" />
                  {allVisibleSelected ? t("inbox.selection.unselectAll") : t("inbox.selection.selectAll")}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={!selectedCount}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="size-4" />
                  {t("inbox.selection.clear")}
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={!selectedCount || isDeleting}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1.2rem] bg-rose-500/14 px-4 text-sm text-rose-100 ring-1 ring-rose-400/20 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? t("inbox.selection.deleting") : t("inbox.selection.delete")}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {initialItems.length ? (
        viewMode === "date" ? (
          <div className="grid gap-5">
            {groupedItems.map((group) => (
              <section key={group.key} className="grid gap-4">
                <div className="flex flex-col gap-2 rounded-[1.5rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{group.label}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{t("inbox.group.records", { count: String(group.itemCount) })}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-slate-200">{t("inbox.group.messages", { count: String(group.messageCount) })}</span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-slate-200">{t("inbox.group.files", { count: String(group.fileCount) })}</span>
                  </div>
                </div>

                <div className="grid gap-4">
                  {group.items.map((item) => renderItem(item))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {initialItems.map((item) => renderItem(item))}
          </div>
        )
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/4 px-6 py-12 text-center text-slate-400">
          {t("inbox.empty")}
        </div>
      )}
    </>
  );
}
