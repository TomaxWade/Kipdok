import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DownloadFileButton } from "@/components/download-file-button";
import { requireSession } from "@/lib/auth";
import { createTranslator, formatLocaleDateTime } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { formatDeviceLabel } from "@/lib/device";
import { formatBytes } from "@/lib/utils";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: { message: true, fileAsset: true, deviceInfo: true },
  });

  if (!item) {
    notFound();
  }

  return (
    <AppShell
      title={t("page.item.title")}
      subtitle={t("page.item.subtitle")}
    >
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">{item.type === "message" ? t("detail.messageType") : t("detail.fileType")}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{item.title || item.fileAsset?.originalFilename || t("detail.untitled")}</h3>
          <p className="mt-2 text-sm text-slate-400">{t("detail.createdAt", { value: formatLocaleDateTime(item.createdAt, locale) })}</p>

          {item.type === "message" ? (
            <div className="mt-6 rounded-[1.5rem] bg-slate-950/60 p-5 text-sm leading-7 text-slate-100 whitespace-pre-wrap selection:bg-cyan-300/30 selection:text-white">
              {item.message?.content}
            </div>
          ) : (
            <div className="mt-6 grid gap-3 rounded-[1.5rem] bg-slate-950/60 p-5 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3"><span>{t("detail.fileName")}</span><span>{item.fileAsset?.originalFilename}</span></div>
              <div className="flex items-center justify-between gap-3"><span>{t("detail.size")}</span><span>{formatBytes(Number(item.fileAsset?.sizeBytes ?? BigInt(0)))}</span></div>
              <div className="flex items-center justify-between gap-3"><span>{t("detail.type")}</span><span>{item.fileAsset?.mimeType || t("file.unknown")}</span></div>
              <div className="flex items-center justify-between gap-3"><span>{t("detail.extension")}</span><span>{item.fileAsset?.extension || t("file.unknown")}</span></div>
              <div className="flex items-center justify-between gap-3"><span>{t("detail.path")}</span><span className="max-w-[60%] truncate">{item.fileAsset?.storedPath}</span></div>
              <DownloadFileButton
                itemId={item.id}
                fileName={item.fileAsset?.originalFilename || "download.bin"}
                fileSize={Number(item.fileAsset?.sizeBytes ?? BigInt(0))}
                className="mt-4 h-11 bg-cyan-400 px-4 font-medium text-slate-950 hover:bg-cyan-300"
              />
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">{t("detail.sourceTitle")}</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="rounded-2xl bg-slate-950/50 px-4 py-3">{t("detail.device", { value: formatDeviceLabel(item.deviceInfo || {}) })}</div>
            <div className="rounded-2xl bg-slate-950/50 px-4 py-3">{t("detail.sourceIpCard", { value: item.deviceInfo?.sourceIp || t("detail.unknownValue") })}</div>
            <div className="rounded-2xl bg-slate-950/50 px-4 py-3">{t("detail.userAgent", { value: item.deviceInfo?.userAgent || t("detail.unknownValue") })}</div>
            <div className="rounded-2xl bg-slate-950/50 px-4 py-3">{t("detail.tailscaleUser", { value: item.deviceInfo?.tailscaleUser || t("detail.noneValue") })}</div>
            <div className="rounded-2xl bg-slate-950/50 px-4 py-3">{t("detail.tailscaleNode", { value: item.deviceInfo?.tailscaleNode || t("detail.noneValue") })}</div>
            {item.type === "message" ? <div className="rounded-2xl bg-slate-950/50 px-4 py-3">{t("detail.logPath", { value: item.message?.logFilePath || t("detail.noneValue") })}</div> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
