"use client";

import { useState, useTransition } from "react";
import { Globe, LoaderCircle, Lock, RefreshCw, Router } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { NETWORK_PROFILE_API_PATH } from "@/lib/routes";
import type { NetworkProfileMode, NetworkProfileStatus } from "@/lib/network-profile";

export function NetworkProfileCard({ initialStatus }: { initialStatus: NetworkProfileStatus }) {
  const router = useRouter();
  const { t } = useI18n();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<Extract<NetworkProfileMode, "open" | "tailnet-only"> | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const busy = pendingMode !== null || isRefreshing;

async function refreshStatus() {
    setError(null);

    try {
      const response = await fetch(NETWORK_PROFILE_API_PATH, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as NetworkProfileStatus | { error?: string };

      if (!response.ok || !("mode" in data)) {
        throw new Error("error" in data ? data.error || t("network.error.refresh") : t("network.error.refresh"));
      }

      setStatus(data);
      startTransition(() => {
        router.refresh();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("network.error.refresh"));
    }
  }

  async function switchMode(mode: Extract<NetworkProfileMode, "open" | "tailnet-only">) {
    setPendingMode(mode);
    setError(null);

    try {
      const response = await fetch(NETWORK_PROFILE_API_PATH, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });

      const data = (await response.json()) as
        | { queued: true; targetMode: Extract<NetworkProfileMode, "open" | "tailnet-only"> }
        | { error?: string };

      if (response.status !== 202 || !("queued" in data)) {
        throw new Error("error" in data ? data.error || t("network.error.switch") : t("network.error.switch"));
      }

      const deadline = Date.now() + 30000;
      let nextStatus: NetworkProfileStatus | null = null;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        try {
          const statusResponse = await fetch(NETWORK_PROFILE_API_PATH, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          });
          const statusData = (await statusResponse.json()) as NetworkProfileStatus | { error?: string };

          if (!statusResponse.ok || !("mode" in statusData)) {
            continue;
          }

          nextStatus = statusData;
          setStatus(statusData);

          if (statusData.mode === mode) {
            startTransition(() => {
              router.refresh();
            });
            return;
          }
        } catch {
          // The server can briefly disappear while the launch agent restarts.
        }
      }

      if (nextStatus) {
        startTransition(() => {
          router.refresh();
        });
      }

      throw new Error(t("network.error.timeout"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("network.error.switch"));
    } finally {
      setPendingMode(null);
    }
  }

  const modeMeta: Record<NetworkProfileMode, { label: string; tone: string; description: string }> = {
    open: {
      label: t("network.mode.open"),
      tone: "bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/30",
      description: t("network.mode.openDescription"),
    },
    "tailnet-only": {
      label: t("network.mode.tailnetOnly"),
      tone: "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/30",
      description: t("network.mode.tailnetOnlyDescription"),
    },
    custom: {
      label: t("network.mode.custom"),
      tone: "bg-slate-400/15 text-slate-100 ring-1 ring-slate-300/20",
      description: t("network.mode.customDescription"),
    },
  };
  const summarizeReachability = (mode: NetworkProfileMode) => {
    if (mode === "open") {
      return t("network.reachability.open");
    }

    if (mode === "tailnet-only") {
      return t("network.reachability.tailnetOnly");
    }

    return t("network.reachability.custom");
  };
  const activeMeta = modeMeta[status.mode];

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${activeMeta.tone}`}>
              {status.mode === "open" ? <Globe className="mr-2 size-3.5" /> : <Lock className="mr-2 size-3.5" />}
              {activeMeta.label}
            </span>
            <span className="text-xs text-slate-400">{t("network.listen", { host: status.launchHost })}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{t("network.title")}</h3>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-300">{activeMeta.description}</p>
            <p className="mt-1 text-sm text-slate-400">{summarizeReachability(status.mode)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => switchMode("tailnet-only")}
            disabled={busy || status.mode === "tailnet-only"}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingMode === "tailnet-only" ? <LoaderCircle className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {t("network.switchTailnetOnly")}
          </button>
          <button
            type="button"
            onClick={() => switchMode("open")}
            disabled={busy || status.mode === "open"}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 text-sm text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingMode === "open" ? <LoaderCircle className="size-4 animate-spin" /> : <Globe className="size-4" />}
            {t("network.switchOpen")}
          </button>
          <button
            type="button"
            onClick={() => {
              void refreshStatus();
            }}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRefreshing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("network.refresh")}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-slate-950/45 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-200">
            <Router className="size-4 text-cyan-300" />
            {t("network.summaryTitle")}
          </div>
          <p className="text-sm leading-7 text-slate-300">
            {status.mode === "open"
              ? t("network.summaryOpen")
              : status.mode === "tailnet-only"
                ? t("network.summaryTailnetOnly")
                : t("network.summaryCustom")}
          </p>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            {t("network.warning")}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="mb-2 text-sm text-slate-200">{t("network.liveStatus")}</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-400">
            {status.serveStatus}
          </pre>
        </div>
      </div>
    </section>
  );
}
