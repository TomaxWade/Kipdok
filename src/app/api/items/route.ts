import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestTranslator } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { parseRequestDevice } from "@/lib/device";
import { prisma } from "@/lib/prisma";
import { formatDeviceLabel } from "@/lib/device";
import { itemInclude, recordEvent, upsertDeviceInfo } from "@/lib/audit";

type ExistingItemEntry = { id: string };

const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const query = searchParams.get("q");

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      ...(type && type !== "all" ? { type: type as "message" | "file" } : {}),
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
    include: itemInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      createdAt: item.createdAt,
      deletedAt: item.deletedAt,
      deviceLabel: formatDeviceLabel(item.deviceInfo || {}),
      sourceIp: item.deviceInfo?.sourceIp || null,
      messageContent: item.message?.content,
      fileName: item.fileAsset?.originalFilename,
      fileSize: item.fileAsset ? Number(item.fileAsset.sizeBytes) : null,
      fileExtension: item.fileAsset?.extension || null,
    })),
  );
}

export async function DELETE(request: Request) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: t("api.items.selectOne") }, { status: 400 });
  }

  const existingItems: ExistingItemEntry[] = await prisma.item.findMany({
    where: {
      id: { in: parsed.data.ids },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!existingItems.length) {
    return NextResponse.json({ ok: true, deletedCount: 0, deletedIds: [] });
  }

  const now = new Date();
  await prisma.item.updateMany({
    where: { id: { in: existingItems.map((item: ExistingItemEntry) => item.id) } },
    data: {
      deletedAt: now,
      deletedNote: "soft-deleted-from-bulk-ui",
    },
  });

  const deviceInfo = await upsertDeviceInfo(await parseRequestDevice());
  await Promise.all(
    existingItems.map((item: ExistingItemEntry) =>
      recordEvent({
        action: "delete_item",
        itemId: item.id,
        deviceInfoId: deviceInfo.id,
        detail: "bulk-delete",
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    deletedCount: existingItems.length,
    deletedIds: existingItems.map((item: ExistingItemEntry) => item.id),
  });
}
