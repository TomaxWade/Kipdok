import { AppShell } from "@/components/app-shell";
import { InboxBoard } from "@/components/inbox-board";
import { type InboxItem } from "@/components/message-bubble";
import { formatDeviceLabel } from "@/lib/device";
import { createTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function parseDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function subtractDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; range?: string; from?: string; to?: string; view?: string }>;
}) {
  await requireSession();
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const params = await searchParams;
  const type = params.type === "message" || params.type === "file" ? params.type : "all";
  const query = params.q ?? "";
  const range = params.range === "today" || params.range === "7d" || params.range === "30d" || params.range === "custom" ? params.range : "all";
  const view = params.view === "flat" ? "flat" : "date";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const now = new Date();
  const createdAtFilter: { gte?: Date; lte?: Date } = {};

  if (range === "today") {
    createdAtFilter.gte = startOfDay(now);
  } else if (range === "7d") {
    createdAtFilter.gte = startOfDay(subtractDays(now, 6));
  } else if (range === "30d") {
    createdAtFilter.gte = startOfDay(subtractDays(now, 29));
  } else if (range === "custom") {
    const parsedFrom = parseDateInput(from);
    const parsedTo = parseDateInput(to);

    if (parsedFrom) {
      createdAtFilter.gte = startOfDay(parsedFrom);
    }

    if (parsedTo) {
      createdAtFilter.lte = endOfDay(parsedTo);
    }
  }

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      ...(type !== "all" ? { type: type as "message" | "file" } : {}),
      ...(createdAtFilter.gte || createdAtFilter.lte ? { createdAt: createdAtFilter } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { message: { content: { contains: query } } },
              { fileAsset: { originalFilename: { contains: query } } },
            ],
          }
        : {}),
    },
    include: {
      message: true,
      fileAsset: true,
      deviceInfo: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const normalized: InboxItem[] = items.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    createdAt: item.createdAt.toISOString(),
    deletedAt: item.deletedAt?.toISOString() ?? null,
    deviceLabel: formatDeviceLabel(item.deviceInfo || {}),
    sourceIp: item.deviceInfo?.sourceIp ?? null,
    messageContent: item.message?.content,
    fileName: item.fileAsset?.originalFilename,
    fileSize: item.fileAsset ? Number(item.fileAsset.sizeBytes) : undefined,
    fileExtension: item.fileAsset?.extension ?? null,
  }));

  return (
    <AppShell
      title={t("page.inbox.title")}
      subtitle={t("page.inbox.subtitle")}
    >
      <InboxBoard
        initialItems={normalized}
        initialFilters={{ type, q: query, range, from, to, view }}
      />
    </AppShell>
  );
}
