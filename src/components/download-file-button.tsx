"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useTransferManager } from "@/components/transfer-provider";
import { cn } from "@/lib/utils";

type DownloadFileButtonProps = {
  itemId: string;
  fileName: string;
  fileSize?: number;
  className?: string;
  iconClassName?: string;
  label?: string;
};

export function DownloadFileButton({
  itemId,
  fileName,
  fileSize,
  className,
  iconClassName,
  label,
}: DownloadFileButtonProps) {
  const { t } = useI18n();
  const { downloadFile, transfers } = useTransferManager();
  const isDownloading = transfers.some(
    (item) => item.direction === "download" && item.resourceId === itemId && (item.status === "queued" || item.status === "running"),
  );
  const resolvedLabel = label ?? t("download.label");

  return (
    <button
      type="button"
      disabled={isDownloading}
      onClick={() => void downloadFile({ itemId, fileName, expectedSize: fileSize })}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {isDownloading ? (
        <LoaderCircle className={cn("size-4 animate-spin", iconClassName)} />
      ) : (
        <Download className={cn("size-4", iconClassName)} />
      )}
      {isDownloading ? t("download.loading") : resolvedLabel}
    </button>
  );
}
