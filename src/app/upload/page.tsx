"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CircleCheckBig, FileUp, ImagePlus, LoaderCircle, MessageSquareShare, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/components/i18n-provider";
import { TransferStatusCard } from "@/components/transfer-status-card";
import { useTransferManager } from "@/components/transfer-provider";
import { LOGIN_ROUTE, MESSAGES_API_PATH, SESSION_API_PATH } from "@/lib/routes";

type UploadStatus =
  | { kind: "idle"; message: string }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function UploadPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [messageStatus, setMessageStatus] = useState<UploadStatus>({
    kind: "idle",
    message: t("upload.status.idle"),
  });
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles, transfers } = useTransferManager();

  useEffect(() => {
    setMessageStatus((current) => (current.kind === "idle" ? { kind: "idle", message: t("upload.status.idle") } : current));
  }, [t]);

  useEffect(() => {
    let active = true;
    fetch(SESSION_API_PATH)
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data.authenticated) {
          router.replace(LOGIN_ROUTE);
          router.refresh();
        }
      })
      .catch(() => {
        if (active) {
          router.replace(LOGIN_ROUTE);
          router.refresh();
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSendingMessage(true);
    setMessageStatus({ kind: "loading", message: t("upload.status.loading") });

    try {
      const response = await fetch(MESSAGES_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: message }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessageStatus({ kind: "error", message: data.error ?? t("upload.status.error") });
        return;
      }

      setMessage("");
      setTitle("");
      setMessageStatus({ kind: "success", message: t("upload.status.success", { id: data.itemId }) });
    } catch {
      setMessageStatus({ kind: "error", message: t("upload.status.networkError") });
    } finally {
      setIsSendingMessage(false);
    }
  }

  function queueFiles(files: FileList | File[], source: "file" | "media") {
    const list = Array.isArray(files) ? files : Array.from(files);
    if (!list.length) {
      return;
    }

    uploadFiles(list, {
      sourceLabel: source === "media" ? t("upload.sourceMedia") : t("upload.sourceFile"),
    });
  }

  function submitFiles(event: React.ChangeEvent<HTMLInputElement>, source: "file" | "media") {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    queueFiles(files, source);
    event.target.value = "";
  }

  function openPicker(input: HTMLInputElement | null) {
    if (!input) return;
    const picker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }
    input.click();
  }

  const activeUploads = transfers.filter((item) => item.direction === "upload" && (item.status === "queued" || item.status === "running")).length;
  const messageTone =
    messageStatus.kind === "success"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : messageStatus.kind === "error"
        ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
        : messageStatus.kind === "loading"
          ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
          : "border-white/10 bg-white/5 text-slate-200";

  return (
    <AppShell
      title={t("page.upload.title")}
      subtitle={t("page.upload.subtitle")}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <section className="app-shell-card rounded-[1.75rem] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="app-kicker">{t("upload.textKicker")}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{t("upload.textTitle")}</h3>
              <p className="mt-1 text-sm text-slate-300">{t("upload.textDescription")}</p>
            </div>
            <div className={`rounded-[1.3rem] border px-4 py-3 text-sm ${messageTone}`}>
              <div className="flex items-center gap-2">
                {messageStatus.kind === "success" ? (
                  <CircleCheckBig className="size-4 shrink-0" />
                ) : messageStatus.kind === "error" ? (
                  <AlertCircle className="size-4 shrink-0" />
                ) : messageStatus.kind === "loading" ? (
                  <LoaderCircle className="size-4 shrink-0 animate-spin" />
                ) : (
                  <Sparkles className="size-4 shrink-0" />
                )}
                <span>{messageStatus.message}</span>
              </div>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={submitMessage}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("upload.titlePlaceholder")}
              className="h-12 rounded-[1.2rem] border border-white/10 bg-slate-950/50 px-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
            />
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("upload.messagePlaceholder")}
              rows={3}
              className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 px-4 py-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
            />
            <button
              type="submit"
              disabled={isSendingMessage}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.2rem] bg-[var(--accent-primary)] px-4 font-medium text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingMessage ? <LoaderCircle className="size-4 animate-spin" /> : <MessageSquareShare className="size-4" />}
              {isSendingMessage ? t("upload.submitting") : t("upload.submit")}
            </button>
          </form>
        </section>

        <div className="grid gap-6">
          <section className="app-shell-card rounded-[1.75rem] p-5">
            <p className="app-kicker">{t("upload.fileKicker")}</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{t("upload.fileTitle")}</h3>
            <p className="mt-1 text-sm text-slate-300">{t("upload.fileDescription")}</p>

            <div className="mt-5 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
                <div>
                  <p className="app-kicker text-[11px]">{t("upload.queueTitle")}</p>
                  <p className="mt-2">{activeUploads ? t("upload.queueActive", { count: activeUploads }) : t("upload.queueEmpty")}</p>
                </div>
                <span className="rounded-full bg-white/6 px-3 py-1 text-xs text-slate-200">{t("upload.queueBadge", { count: activeUploads })}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openPicker(generalFileInputRef.current)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 text-sm text-white transition hover:bg-white/10"
                >
                  <FileUp className="size-4" />
                  {t("upload.pickFile")}
                </button>
                <button
                  type="button"
                  onClick={() => openPicker(mediaFileInputRef.current)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.2rem] border border-cyan-300/15 bg-cyan-300/8 px-4 text-sm text-cyan-50 transition hover:border-cyan-300/35 hover:bg-cyan-300/12"
                >
                  <ImagePlus className="size-4" />
                  {t("upload.pickMedia")}
                </button>
              </div>

              <p className="rounded-[1.35rem] border border-white/10 bg-slate-950/40 px-4 py-3 text-xs leading-6 text-slate-400">
                {t("upload.mobileTip")}
              </p>

              <label
                className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-6 py-8 text-center transition ${
                  dropActive
                    ? "border-cyan-300/60 bg-cyan-300/10"
                    : "border-white/15 bg-slate-950/40 hover:border-cyan-300/40 hover:bg-slate-950/60"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropActive(false);
                  if (event.dataTransfer.files.length) {
                    queueFiles(event.dataTransfer.files, "file");
                  }
                }}
              >
                <span className="text-lg font-medium text-white">{t("upload.dropTitle")}</span>
                <span className="mt-2 text-sm text-slate-400">{t("upload.dropSubtitle")}</span>
                <input ref={generalFileInputRef} type="file" accept="*/*" multiple className="hidden" onChange={(event) => submitFiles(event, "file")} />
              </label>

              <input ref={mediaFileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(event) => submitFiles(event, "media")} />
            </div>
          </section>
        </div>
      </div>

      <div className="mt-6">
        <TransferStatusCard />
      </div>
    </AppShell>
  );
}
