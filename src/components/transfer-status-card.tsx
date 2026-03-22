"use client";

import { AlertCircle, CircleCheckBig, Download, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { TransferDirection, TransferItem, useTransferManager } from "@/components/transfer-provider";
import { cn, formatBytes, formatTransferSpeed } from "@/lib/utils";

function statusLabel(status: TransferItem["status"], t: ReturnType<typeof useI18n>["t"]) {
  if (status === "queued") return t("transfer.status.queued");
  if (status === "running") return t("transfer.status.running");
  if (status === "success") return t("transfer.status.success");
  return t("transfer.status.error");
}

function progressValue(item: TransferItem) {
  if (item.totalBytes <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((item.transferredBytes / item.totalBytes) * 100)));
}

function sortTransfers(items: TransferItem[]) {
  const statusRank: Record<TransferItem["status"], number> = {
    running: 0,
    queued: 1,
    error: 2,
    success: 3,
  };

  return [...items].sort((left, right) => {
    const leftRank = statusRank[left.status];
    const rightRank = statusRank[right.status];
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return right.startedAt - left.startedAt;
  });
}

function TransferLane({
  direction,
  title,
}: {
  direction: TransferDirection;
  title: string;
}) {
  const { t } = useI18n();
  const { transfers } = useTransferManager();
  const items = sortTransfers(transfers.filter((item) => item.direction === direction));
  const activeCount = items.filter((item) => item.status === "queued" || item.status === "running").length;

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-3.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
            {direction === "upload" ? <Upload className="size-4 text-cyan-300" /> : <Download className="size-4 text-emerald-300" />}
            {title}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            direction === "upload" ? "bg-cyan-300/12 text-cyan-100" : "bg-emerald-300/12 text-emerald-100",
          )}
        >
          {t("transfer.activeCount", { count: activeCount })}
        </span>
      </div>

      {items.length ? (
        <div className="mt-3 grid gap-3">
          {items.map((item) => {
            const progress = progressValue(item);
            const tone =
              item.status === "success"
                ? "border-emerald-400/20 bg-emerald-400/8"
                : item.status === "error"
                  ? "border-rose-400/20 bg-rose-400/8"
                  : item.direction === "upload"
                    ? "border-cyan-300/15 bg-cyan-300/6"
                    : "border-emerald-300/15 bg-emerald-300/6";

            return (
          <article key={item.id} className={cn("rounded-[1.25rem] border p-3.5", tone)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-medium text-white">{item.name}</h4>
                      {item.sourceLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-300">
                          {item.sourceLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.totalBytes > 0 ? formatBytes(item.totalBytes) : t("transfer.unknownSize")}
                      {item.status === "running" && item.speedBytesPerSecond > 0 ? ` · ${formatTransferSpeed(item.speedBytesPerSecond)}` : null}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                      item.status === "success"
                        ? "bg-emerald-300/12 text-emerald-100"
                        : item.status === "error"
                          ? "bg-rose-300/12 text-rose-100"
                          : "bg-white/8 text-slate-100",
                    )}
                  >
                    {item.status === "success" ? (
                      <CircleCheckBig className="size-3" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="size-3" />
                    ) : (
                      <LoaderCircle className="size-3 animate-spin" />
                    )}
                    {statusLabel(item.status, t)}
                  </span>
                </div>

                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
                    <span>
                      {formatBytes(item.transferredBytes)}
                      {item.totalBytes > 0 ? ` / ${formatBytes(item.totalBytes)}` : null}
                    </span>
                    <span>{item.totalBytes > 0 ? `${progress}%` : item.status === "running" ? t("transfer.status.running") : statusLabel(item.status, t)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-300",
                        item.status === "error"
                          ? "bg-rose-300"
                          : item.direction === "upload"
                            ? "bg-cyan-300"
                            : "bg-emerald-300",
                        item.totalBytes <= 0 && item.status === "running" && "w-1/3 animate-pulse",
                      )}
                      style={item.totalBytes > 0 ? { width: `${progress}%` } : undefined}
                    />
                  </div>
                </div>

                {item.errorMessage ? <p className="mt-2.5 text-xs leading-6 text-rose-100">{item.errorMessage}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-[1.25rem] border border-dashed border-white/10 bg-white/3 px-4 py-6 text-sm text-slate-400">
          {direction === "upload" ? t("transfer.noUploadTasks") : t("transfer.noDownloadTasks")}
        </div>
      )}
    </section>
  );
}

export function TransferStatusCard() {
  const { t } = useI18n();
  const { transfers, clearFinishedTransfers } = useTransferManager();
  const hasFinished = transfers.some((item) => item.status === "success" || item.status === "error");
  const activeCount = transfers.filter((item) => item.status === "queued" || item.status === "running").length;
  const completedCount = transfers.filter((item) => item.status === "success").length;
  const failedCount = transfers.filter((item) => item.status === "error").length;

  return (
    <section className="app-shell-card rounded-[1.75rem] p-4">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="app-kicker">{t("transfer.kicker")}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{t("transfer.title")}</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: t("transfer.active"), value: activeCount, tone: "text-cyan-50" },
            { label: t("transfer.completed"), value: completedCount, tone: "text-emerald-100" },
            { label: t("transfer.failed"), value: failedCount, tone: "text-rose-100" },
          ].map((card) => (
            <div key={card.label} className="app-shell-card--muted rounded-[1.25rem] px-3 py-2.5">
              <p className="text-xs text-slate-400">{card.label}</p>
              <p className={`app-stat-value mt-1.5 text-xl font-semibold ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-200">
          {t("transfer.total", { count: transfers.length })}
        </span>
        {hasFinished ? (
          <button
            type="button"
            onClick={clearFinishedTransfers}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <RefreshCw className="size-4" />
            {t("transfer.clearFinished")}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <TransferLane direction="upload" title={t("transfer.uploadLane")} />
        <TransferLane direction="download" title={t("transfer.downloadLane")} />
      </div>
    </section>
  );
}
