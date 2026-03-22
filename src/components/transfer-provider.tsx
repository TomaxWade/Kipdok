"use client";

import { createContext, useContext, useState } from "react";
import { buildFileDownloadPath, FILES_API_PATH } from "@/lib/routes";

export type TransferDirection = "upload" | "download";
export type TransferStatus = "queued" | "running" | "success" | "error";

export type TransferItem = {
  id: string;
  resourceId?: string;
  direction: TransferDirection;
  sourceLabel?: string;
  name: string;
  totalBytes: number;
  transferredBytes: number;
  speedBytesPerSecond: number;
  status: TransferStatus;
  startedAt: number;
  finishedAt?: number;
  errorMessage?: string;
};

type UploadFilesOptions = {
  sourceLabel?: string;
};

type DownloadFileOptions = {
  itemId: string;
  fileName: string;
  expectedSize?: number | null;
};

type TransferContextValue = {
  transfers: TransferItem[];
  uploadFiles: (files: File[], options?: UploadFilesOptions) => void;
  downloadFile: (options: DownloadFileOptions) => Promise<void>;
  clearFinishedTransfers: () => void;
};

const TransferContext = createContext<TransferContextValue | null>(null);

function createTransferId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function trimTransferHistory(items: TransferItem[]) {
  return items.slice(0, 40);
}

export function TransferProvider({ children }: { children: React.ReactNode }) {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);

  function addTransfer(item: TransferItem) {
    setTransfers((current) => trimTransferHistory([item, ...current]));
  }

  function patchTransfer(id: string, patch: Partial<TransferItem>) {
    setTransfers((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }

  function clearFinishedTransfers() {
    setTransfers((current) => current.filter((item) => item.status === "queued" || item.status === "running"));
  }

  function uploadFiles(files: File[], options?: UploadFilesOptions) {
    files.forEach((file) => {
      const id = createTransferId();
      const startedAt = Date.now();

      addTransfer({
        id,
        direction: "upload",
        name: file.name,
        sourceLabel: options?.sourceLabel,
        totalBytes: file.size,
        transferredBytes: 0,
        speedBytesPerSecond: 0,
        status: "queued",
        startedAt,
      });

      const formData = new FormData();
      formData.append("files", file);

      const request = new XMLHttpRequest();
      request.open("POST", FILES_API_PATH);

      request.upload.addEventListener("loadstart", () => {
        patchTransfer(id, { status: "running" });
      });

      request.upload.addEventListener("progress", (event) => {
        const loaded = event.loaded;
        const totalBytes = event.lengthComputable && event.total > 0 ? event.total : file.size;
        const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1);

        patchTransfer(id, {
          status: "running",
          transferredBytes: loaded,
          totalBytes,
          speedBytesPerSecond: loaded / elapsedSeconds,
        });
      });

      request.addEventListener("load", () => {
        const payload =
          typeof request.response === "object" && request.response
            ? request.response
            : JSON.parse(request.responseText || "{}");

        if (request.status >= 200 && request.status < 300) {
          patchTransfer(id, {
            status: "success",
            transferredBytes: file.size,
            totalBytes: file.size,
            speedBytesPerSecond: 0,
            finishedAt: Date.now(),
          });
          return;
        }

        patchTransfer(id, {
          status: "error",
          speedBytesPerSecond: 0,
          finishedAt: Date.now(),
          errorMessage: payload.error ?? "文件上传失败",
        });
      });

      request.addEventListener("error", () => {
        patchTransfer(id, {
          status: "error",
          speedBytesPerSecond: 0,
          finishedAt: Date.now(),
          errorMessage: "网络异常，文件上传失败",
        });
      });

      request.addEventListener("abort", () => {
        patchTransfer(id, {
          status: "error",
          speedBytesPerSecond: 0,
          finishedAt: Date.now(),
          errorMessage: "上传已取消",
        });
      });

      request.send(formData);
    });
  }

  async function downloadFile({ itemId, fileName, expectedSize }: DownloadFileOptions) {
    const id = createTransferId();
    const startedAt = Date.now();

    addTransfer({
      id,
      resourceId: itemId,
      direction: "download",
      name: fileName,
      totalBytes: expectedSize ?? 0,
      transferredBytes: 0,
      speedBytesPerSecond: 0,
      status: "queued",
      startedAt,
    });

    try {
      patchTransfer(id, { status: "running" });

      const response = await fetch(buildFileDownloadPath(itemId), { cache: "no-store" });
      const payload = response.clone();

      if (!response.ok) {
        const errorData = await payload.json().catch(() => ({}));
        throw new Error(errorData.error ?? "文件下载失败");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("当前浏览器不支持流式下载");
      }

      const headerBytes = Number(response.headers.get("content-length") ?? "");
      const totalBytes =
        Number.isFinite(headerBytes) && headerBytes > 0 ? headerBytes : expectedSize && expectedSize > 0 ? expectedSize : 0;
      const chunks: BlobPart[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        chunks.push(new Uint8Array(value));
        receivedBytes += value.byteLength;

        const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1);
        patchTransfer(id, {
          status: "running",
          transferredBytes: receivedBytes,
          totalBytes: totalBytes || receivedBytes,
          speedBytesPerSecond: receivedBytes / elapsedSeconds,
        });
      }

      const blob = new Blob(chunks, {
        type: response.headers.get("content-type") || "application/octet-stream",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      patchTransfer(id, {
        status: "success",
        transferredBytes: receivedBytes,
        totalBytes: totalBytes || receivedBytes,
        speedBytesPerSecond: 0,
        finishedAt: Date.now(),
      });
    } catch (error) {
      patchTransfer(id, {
        status: "error",
        speedBytesPerSecond: 0,
        finishedAt: Date.now(),
        errorMessage: error instanceof Error ? error.message : "文件下载失败",
      });
    }
  }

  return (
    <TransferContext.Provider
      value={{
        transfers,
        uploadFiles,
        downloadFile,
        clearFinishedTransfers,
      }}
    >
      {children}
    </TransferContext.Provider>
  );
}

export function useTransferManager() {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error("useTransferManager must be used inside TransferProvider");
  }

  return context;
}
