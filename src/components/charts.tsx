"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n-provider";
import { formatBytes } from "@/lib/utils";

const colors = ["#22d3ee", "#38bdf8", "#818cf8", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#f87171"];

function ChartEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-44 items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-slate-950/45 px-6 text-center">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-2 text-xs leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function useChartReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReady(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return ready;
}

function ChartFrame({
  title,
  subtitle,
  heightClass,
  children,
}: {
  title: string;
  subtitle: string;
  heightClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid ${heightClass} grid-rows-[auto_1fr] rounded-[1.75rem] border border-white/10 bg-white/5 p-4`}>
      <div className="mb-4">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      <div className="min-h-0">{children}</div>
    </div>
  );
}

export function TrendChart({ data }: { data: Array<{ date: string; uploads: number; downloads: number; messages: number; files: number }> }) {
  const { t } = useI18n();
  const ready = useChartReady();

  return (
    <ChartFrame title={t("chart.trend.title")} subtitle={t("chart.trend.subtitle")} heightClass="h-80 w-full">
      {ready && data.length ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18 }} />
            <Line type="monotone" dataKey="uploads" stroke="#22d3ee" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="downloads" stroke="#818cf8" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : ready ? (
        <ChartEmptyState title={t("chart.trend.emptyTitle")} description={t("chart.trend.emptyDescription")} />
      ) : (
        <ChartEmptyState title={t("chart.loadingTitle")} description={t("chart.loadingDescriptionTrend")} />
      )}
    </ChartFrame>
  );
}

export function TimelineChart({ data }: { data: Array<{ createdAt: string; score: number }> }) {
  const { t } = useI18n();
  const ready = useChartReady();

  return (
    <ChartFrame title={t("chart.timeline.title")} subtitle={t("chart.timeline.subtitle")} heightClass="h-72 w-full">
      {ready && data.length ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="timelineFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="createdAt" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18 }} />
            <Area type="monotone" dataKey="score" stroke="#22d3ee" fill="url(#timelineFill)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      ) : ready ? (
        <ChartEmptyState title={t("chart.timeline.emptyTitle")} description={t("chart.timeline.emptyDescription")} />
      ) : (
        <ChartEmptyState title={t("chart.loadingTitle")} description={t("chart.loadingDescriptionTimeline")} />
      )}
    </ChartFrame>
  );
}

export function StoragePieChart({ data }: { data: Array<{ name: string; value: number; percentage: number }> }) {
  const { t } = useI18n();
  const ready = useChartReady();
  const totalBytes = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 lg:grid-cols-[300px_1fr]">
      <div className="flex h-72 w-full items-center justify-center rounded-[1.5rem] bg-slate-950/35">
        {ready && data.length ? (
          <div className="relative h-full w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <PieChart>
                <Pie data={data} innerRadius={60} outerRadius={92} dataKey="value" nameKey="name" paddingAngle={4}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatBytes(typeof value === "number" ? value : Number(value ?? 0))} contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{t("chart.storage.total")}</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatBytes(totalBytes)}</p>
              </div>
            </div>
          </div>
        ) : ready ? (
          <div className="relative flex size-56 items-center justify-center rounded-full border-[18px] border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_rgba(15,23,42,0.1)_58%,_rgba(2,6,23,0.9)_100%)]">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{t("chart.storage.share")}</p>
              <p className="mt-3 text-lg font-semibold text-white">{t("chart.storage.emptyTitle")}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{t("chart.storage.emptyDescription")}</p>
            </div>
          </div>
        ) : (
          <div className="relative flex size-56 animate-pulse items-center justify-center rounded-full border-[18px] border-white/10 bg-slate-900/60">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{t("chart.storage.share")}</p>
              <p className="mt-3 text-lg font-semibold text-white">{t("chart.storage.loadingTitle")}</p>
            </div>
          </div>
        )}
      </div>
      <div className="grid content-start gap-3">
        <div>
          <p className="text-sm font-medium text-white">{t("chart.storage.legendTitle")}</p>
          <p className="text-xs text-slate-400">{t("chart.storage.legendDescription")}</p>
        </div>
        {data.length ? (
          data.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-slate-950/50 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="text-slate-200">{entry.name}</span>
              </div>
              <div className="text-right">
                <p className="text-white">{formatBytes(entry.value)}</p>
                <p className="text-xs text-slate-400">{entry.percentage}%</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
            {t("chart.storage.emptyLegend")}
          </div>
        )}
      </div>
    </div>
  );
}
