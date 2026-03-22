import path from "node:path";
import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { parseRequestDevice } from "@/lib/device";
import { env } from "@/lib/env";
import { getCurrentSession } from "@/lib/auth";
import { saveIncomingFile } from "@/lib/storage";
import { recordEvent, upsertDeviceInfo } from "@/lib/audit";

export async function POST(request: Request) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: t("api.file.selectOne") }, { status: 400 });
  }

  const maxBytes = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
  const oversized = files.find((file) => file.size > maxBytes);
  if (oversized) {
    return NextResponse.json({ error: t("api.file.tooLarge", { name: oversized.name, size: env.MAX_UPLOAD_SIZE_MB }) }, { status: 400 });
  }

  const device = await parseRequestDevice();
  const deviceInfo = await upsertDeviceInfo(device);

  const created = [] as string[];

  for (const file of files) {
    const saved = await saveIncomingFile(file);
    const item = await prisma.item.create({
      data: {
        type: "file",
        title: file.name,
        deviceInfoId: deviceInfo.id,
        fileAsset: {
          create: {
            originalFilename: file.name,
            storedFilename: saved.storedFilename,
            storedPath: saved.fullPath,
            mimeType: file.type || null,
            extension: saved.extension,
            sizeBytes: saved.sizeBytes,
            sha256: saved.sha256,
          },
        },
      },
    });

    created.push(item.id);
    await recordEvent({
      action: "upload_file",
      itemId: item.id,
      deviceInfoId: deviceInfo.id,
      detail: `${file.name}:${path.extname(file.name)}`,
    });
  }

  return NextResponse.json({ ok: true, itemIds: created });
}
