"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Copy, Ellipsis, Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { formatLocaleDateTime } from "@/i18n";
import { DownloadFileButton } from "@/components/download-file-button";
import { cn, formatBytes } from "@/lib/utils";
import { buildItemApiPath, buildItemRoute } from "@/lib/routes";

export type InboxItem = {
  id: string;
  type: "message" | "file";
  title: string | null;
  createdAt: string;
  deletedAt: string | null;
  deviceLabel: string;
  sourceIp: string | null;
  messageContent?: string;
  fileName?: string;
  fileSize?: number;
  fileExtension?: string | null;
};

function ActionButton({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-2 text-left text-sm transition",
        variant === "danger"
          ? "bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
          : "bg-white/5 text-slate-200 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

type BubbleProps = {
  item: InboxItem;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

export function MessageBubble({ item, selectionMode = false, selected = false, onToggleSelect }: BubbleProps) {
  const { locale, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();

  const copyText = async () => {
    if (item.messageContent) {
      await navigator.clipboard.writeText(item.messageContent);
      setMenuOpen(false);
    }
  };

  const deleteItem = async () => {
    const confirmed = window.confirm(t("message.deleteConfirm"));
    if (!confirmed) return;
    await fetch(buildItemApiPath(item.id), { method: "DELETE" });
    setMenuOpen(false);
    startDeleteTransition(() => {
      router.refresh();
    });
  };

  return (
    <article
      className={cn(
        "app-shell-card app-shell-card--popover-host relative rounded-[2rem] border-[rgba(102,219,200,0.18)] bg-[linear-gradient(180deg,_rgba(102,219,200,0.08),_rgba(5,11,20,0.94))] p-5 text-slate-100",
        selectionMode && "pl-16",
        menuOpen && "z-30",
        selected && "ring-2 ring-cyan-300/45",
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen((prev) => !prev);
      }}
      onPointerDown={() => {
        const timer = window.setTimeout(() => setMenuOpen(true), 450);
        const cancel = () => {
          window.clearTimeout(timer);
          window.removeEventListener("pointerup", cancel);
          window.removeEventListener("pointercancel", cancel);
        };
        window.addEventListener("pointerup", cancel, { once: true });
        window.addEventListener("pointercancel", cancel, { once: true });
      }}
    >
      {selectionMode ? (
        <button
          type="button"
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect?.();
          }}
          className={cn(
            "absolute left-5 top-5 z-20 rounded-full border p-1.5 transition",
            selected
              ? "border-cyan-300/50 bg-cyan-300/14 text-cyan-100"
              : "border-white/12 bg-white/6 text-slate-300 hover:bg-white/10",
          )}
        >
          {selected ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
        </button>
      ) : null}

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[rgba(102,219,200,0.18)] bg-[rgba(102,219,200,0.12)] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-50">
              {t("message.tag")}
            </span>
            {item.sourceIp ? (
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] text-slate-300">IP {item.sourceIp}</span>
            ) : null}
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">{item.title || t("message.untitled")}</h3>
          <p className="mt-2 text-xs text-slate-400">{formatLocaleDateTime(item.createdAt, locale)} · {item.deviceLabel}</p>
        </div>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => setMenuOpen((prev) => !prev)}
          className="rounded-full border border-white/10 bg-white/6 p-2 text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Ellipsis className="size-4" />
        </button>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-slate-100 whitespace-pre-wrap selection:bg-cyan-300/30 selection:text-white">
        {item.messageContent}
      </div>

      {menuOpen ? (
        <div className="absolute right-4 top-16 z-40 grid min-w-44 gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/30 backdrop-blur">
          <ActionButton onClick={copyText}><span className="inline-flex items-center gap-2"><Copy className="size-4" />{t("message.copy")}</span></ActionButton>
          <ActionButton
            onClick={() => {
              setMenuOpen(false);
              router.push(buildItemRoute(item.id));
            }}
          >
            <span className="inline-flex items-center gap-2"><Eye className="size-4" />{t("message.view")}</span>
          </ActionButton>
          <ActionButton variant="danger" onClick={deleteItem}><span className="inline-flex items-center gap-2"><Trash2 className="size-4" />{t("message.delete")}</span></ActionButton>
        </div>
      ) : null}
    </article>
  );
}

export function FileBubble({ item, selectionMode = false, selected = false, onToggleSelect }: BubbleProps) {
  const { locale, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();

  const deleteItem = async () => {
    const confirmed = window.confirm(t("file.deleteConfirm"));
    if (!confirmed) return;
    await fetch(buildItemApiPath(item.id), { method: "DELETE" });
    setMenuOpen(false);
    startDeleteTransition(() => {
      router.refresh();
    });
  };

  return (
    <article
      className={cn(
        "app-shell-card app-shell-card--popover-host relative rounded-[2rem] p-5 text-slate-100",
        selectionMode && "pl-16",
        menuOpen && "z-30",
        selected && "ring-2 ring-cyan-300/45",
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen((prev) => !prev);
      }}
      onPointerDown={() => {
        const timer = window.setTimeout(() => setMenuOpen(true), 450);
        const cancel = () => {
          window.clearTimeout(timer);
          window.removeEventListener("pointerup", cancel);
          window.removeEventListener("pointercancel", cancel);
        };
        window.addEventListener("pointerup", cancel, { once: true });
        window.addEventListener("pointercancel", cancel, { once: true });
      }}
    >
      {selectionMode ? (
        <button
          type="button"
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect?.();
          }}
          className={cn(
            "absolute left-5 top-5 z-20 rounded-full border p-1.5 transition",
            selected
              ? "border-cyan-300/50 bg-cyan-300/14 text-cyan-100"
              : "border-white/12 bg-white/6 text-slate-300 hover:bg-white/10",
          )}
        >
          {selected ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
        </button>
      ) : null}

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[rgba(74,222,128,0.18)] bg-[rgba(74,222,128,0.1)] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-50">
              {t("file.tag")}
            </span>
            {item.fileExtension ? (
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] text-slate-300">{item.fileExtension}</span>
            ) : null}
          </div>
          <h3 className="mt-4 truncate text-lg font-semibold text-white">{item.fileName}</h3>
          <p className="mt-2 text-xs text-slate-400">{formatLocaleDateTime(item.createdAt, locale)} · {item.deviceLabel}</p>
          {item.sourceIp ? <p className="mt-1 text-[11px] text-slate-500">{t("file.sourceIp", { ip: item.sourceIp })}</p> : null}
        </div>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => setMenuOpen((prev) => !prev)}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Ellipsis className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">{formatBytes(item.fileSize || 0)}</span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">{item.fileExtension || t("file.unknown")}</span>
      </div>

      {menuOpen ? (
        <div className="absolute right-4 top-16 z-40 grid min-w-44 gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/30 backdrop-blur">
          <DownloadFileButton
            itemId={item.id}
            fileName={item.fileName || "download.bin"}
            fileSize={item.fileSize}
            className="justify-start rounded-xl bg-white/5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
            iconClassName="size-4"
          />
          <ActionButton
            onClick={() => {
              navigator.clipboard.writeText(item.fileName || "");
              setMenuOpen(false);
            }}
          >
            <span className="inline-flex items-center gap-2"><Copy className="size-4" />{t("file.copyName")}</span>
          </ActionButton>
          <ActionButton
            onClick={() => {
              setMenuOpen(false);
              router.push(buildItemRoute(item.id));
            }}
          >
            <span className="inline-flex items-center gap-2"><Eye className="size-4" />{t("file.view")}</span>
          </ActionButton>
          <ActionButton variant="danger" onClick={deleteItem}><span className="inline-flex items-center gap-2"><Trash2 className="size-4" />{t("file.delete")}</span></ActionButton>
        </div>
      ) : null}
    </article>
  );
}
