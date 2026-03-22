import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRequestDevice } from "@/lib/device";
import { itemInclude, recordEvent, upsertDeviceInfo } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: itemInclude,
  });

  if (!item) {
    return NextResponse.json({ error: t("api.items.notFound") }, { status: 404 });
  }

  const deviceInfo = await upsertDeviceInfo(await parseRequestDevice());
  await recordEvent({ action: "view_item", itemId: item.id, deviceInfoId: deviceInfo.id });

  return NextResponse.json(item);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: t("api.items.notFound") }, { status: 404 });
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedNote: "soft-deleted-from-ui",
    },
  });

  const deviceInfo = await upsertDeviceInfo(await parseRequestDevice());
  await recordEvent({ action: "delete_item", itemId: id, deviceInfoId: deviceInfo.id });

  return NextResponse.json({ ok: true, item: updated });
}
