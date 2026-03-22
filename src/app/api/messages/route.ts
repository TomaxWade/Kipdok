import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestTranslator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { parseRequestDevice } from "@/lib/device";
import { appendMessageLog } from "@/lib/storage";
import { getCurrentSession } from "@/lib/auth";
import { recordEvent, upsertDeviceInfo } from "@/lib/audit";

const schema = z.object({
  content: z.string().trim().min(1).max(10000),
  title: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: t("api.message.empty") }, { status: 400 });
  }

  const device = await parseRequestDevice();
  const deviceInfo = await upsertDeviceInfo(device);

  const item = await prisma.item.create({
    data: {
      type: "message",
      title: parsed.data.title || null,
      deviceInfoId: deviceInfo.id,
      message: {
        create: {
          content: parsed.data.content,
          logFilePath: "pending",
        },
      },
    },
    include: { message: true },
  });

  const logFilePath = await appendMessageLog({
    messageId: item.id,
    content: parsed.data.content,
    device,
    createdAt: item.createdAt,
  });

  await prisma.messageContent.update({
    where: { itemId: item.id },
    data: { logFilePath },
  });

  await recordEvent({
    action: "upload_message",
    itemId: item.id,
    deviceInfoId: deviceInfo.id,
    detail: parsed.data.title || "message",
  });

  return NextResponse.json({ ok: true, itemId: item.id });
}
