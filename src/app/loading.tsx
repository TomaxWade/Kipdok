"use client";

import { useI18n } from "@/components/i18n-provider";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded-2xl bg-white/8 ${className}`} />;
}

export default function Loading() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen px-4 py-4 text-slate-100 sm:px-6 xl:px-8">
      <div className="mx-auto grid min-h-screen max-w-[1560px] animate-pulse gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="app-shell-card w-full rounded-[2rem] p-4 lg:p-5">
          <SkeletonBlock className="mb-5 h-28 w-full rounded-[1.7rem]" />
          <div className="grid gap-2">
            <SkeletonBlock className="h-12 w-full rounded-[1.35rem]" />
            <SkeletonBlock className="h-12 w-full rounded-[1.35rem]" />
            <SkeletonBlock className="h-12 w-full rounded-[1.35rem]" />
          </div>
          <SkeletonBlock className="mt-auto h-12 w-full rounded-[1.35rem]" />
        </aside>

        <main className="app-shell-card rounded-[2rem] p-5 sm:p-8">
          <div className="mb-8 border-b border-white/10 pb-5">
            <div>
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="mt-4 h-10 w-56" />
              <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl" />
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
              <div className="size-3 rounded-full bg-cyan-300/70" />
              {t("loading.page")}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SkeletonBlock className="h-40 w-full" />
            <SkeletonBlock className="h-40 w-full" />
            <SkeletonBlock className="h-40 w-full" />
          </div>
        </main>
      </div>
    </div>
  );
}
