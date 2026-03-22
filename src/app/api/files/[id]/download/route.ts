import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRequestDevice } from "@/lib/device";
import { recordEvent, upsertDeviceInfo } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: { fileAsset: true },
  });

  if (!item?.fileAsset || item.deletedAt) {
    return NextResponse.json({ error: t("api.files.notFound") }, { status: 404 });
  }

  const file = item.fileAsset;
  const stats = await stat(file.storedPath);
  const stream = Readable.toWeb(createReadStream(file.storedPath)) as ReadableStream;
  const deviceInfo = await upsertDeviceInfo(await parseRequestDevice());
  await recordEvent({ action: "download_file", itemId: id, deviceInfoId: deviceInfo.id });

  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`,
      "Content-Length": String(stats.size),
    },
  });
}
