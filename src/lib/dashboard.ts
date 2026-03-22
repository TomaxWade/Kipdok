import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export type DashboardEventEntry = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  browserName: string | null;
  osName: string | null;
  sourceIp: string | null;
  tailscaleNode: string | null;
};

export type StorageBreakdownEntry = {
  name: string;
  value: number;
  percentage: number;
};

type FileAssetSummary = {
  extension: string | null;
  sizeBytes: bigint;
};

function getRange(start?: string, end?: string) {
  const defaultEnd = endOfDay(new Date());
  const defaultStart = startOfDay(subDays(defaultEnd, 29));
  return {
    start: start ? startOfDay(new Date(start)) : defaultStart,
    end: end ? endOfDay(new Date(end)) : defaultEnd,
  };
}

function normalizeEvent(event: {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date;
  deviceInfo: {
    browserName: string | null;
    osName: string | null;
    sourceIp: string | null;
    tailscaleNode: string | null;
  } | null;
}) {
  return {
    id: event.id,
    action: event.action,
    detail: event.detail,
    createdAt: event.createdAt.toISOString(),
    browserName: event.deviceInfo?.browserName ?? null,
    osName: event.deviceInfo?.osName ?? null,
    sourceIp: event.deviceInfo?.sourceIp ?? null,
    tailscaleNode: event.deviceInfo?.tailscaleNode ?? null,
  } satisfies DashboardEventEntry;
}

export async function getDashboardSummary() {
  const [messageCount, fileCount, fileAssets, totalEventCount]: [
    number,
    number,
    FileAssetSummary[],
    number,
  ] = await Promise.all([
    prisma.item.count({ where: { type: "message", deletedAt: null } }),
    prisma.item.count({ where: { type: "file", deletedAt: null } }),
    prisma.fileAsset.findMany({
      where: { item: { deletedAt: null } },
      select: { sizeBytes: true, extension: true },
    }),
    prisma.accessEvent.count(),
  ]);

  const totalBytes = fileAssets.reduce(
    (sum: number, asset: FileAssetSummary) => sum + Number(asset.sizeBytes),
    0,
  );
  const byExtension = fileAssets.reduce<Record<string, { count: number; sizeBytes: number }>>(
    (acc: Record<string, { count: number; sizeBytes: number }>, asset: FileAssetSummary) => {
      const key = asset.extension || "unknown";
      const current = acc[key] ?? { count: 0, sizeBytes: 0 };
      current.count += 1;
      current.sizeBytes += Number(asset.sizeBytes);
      acc[key] = current;
      return acc;
    },
    {},
  );

  return {
    messageCount,
    fileCount,
    totalBytes,
    byExtension: Object.entries(byExtension)
      .map(([extension, value]) => ({ extension, ...value }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes),
    totalEventCount,
  };
}

export async function getRecentEventsPage(offset = 0, limit = 10) {
  const [events, totalCount] = await Promise.all([
    prisma.accessEvent.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: { deviceInfo: true },
    }),
    prisma.accessEvent.count(),
  ]);

  const nextOffset = offset + events.length < totalCount ? offset + events.length : null;

  return {
    events: events.map(normalizeEvent),
    totalCount,
    nextOffset,
  };
}

export async function getTimeline(limit = 100) {
  return prisma.accessEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      deviceInfo: true,
      item: {
        include: { fileAsset: true, message: true },
      },
    },
  });
}

export async function getTrendSeries(start?: string, end?: string) {
  const range = getRange(start, end);
  const events = await prisma.accessEvent.findMany({
    where: {
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const bucket = new Map<string, { uploads: number; downloads: number; messages: number; files: number }>();

  for (const event of events) {
    const key = format(event.createdAt, "yyyy-MM-dd");
    const current = bucket.get(key) ?? { uploads: 0, downloads: 0, messages: 0, files: 0 };

    if (event.action === "upload_file") {
      current.uploads += 1;
      current.files += 1;
    }
    if (event.action === "upload_message") {
      current.uploads += 1;
      current.messages += 1;
    }
    if (event.action === "download_file") {
      current.downloads += 1;
    }

    bucket.set(key, current);
  }

  return Array.from(bucket.entries()).map(([date, value]) => ({ date, ...value }));
}

export async function getStorageBreakdown(): Promise<StorageBreakdownEntry[]> {
  const assets: FileAssetSummary[] = await prisma.fileAsset.findMany({
    where: { item: { deletedAt: null } },
    select: { extension: true, sizeBytes: true },
  });
  const total = assets.reduce((sum: number, asset: FileAssetSummary) => sum + Number(asset.sizeBytes), 0);
  const grouped = assets.reduce<Record<string, number>>(
    (acc: Record<string, number>, asset: FileAssetSummary) => {
      const key = asset.extension || "unknown";
      acc[key] = (acc[key] ?? 0) + Number(asset.sizeBytes);
      return acc;
    },
    {},
  );

  return Object.entries(grouped)
    .map(([name, value]): StorageBreakdownEntry => ({
      name,
      value,
      percentage: total ? Number(((value / total) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}
