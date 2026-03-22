import crypto from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import type { ParsedDevice } from "@/lib/device";
import { ensureDataDirs, messagesRoot, uploadsRoot } from "@/lib/env";

export async function ensureUploadDayDir(date = new Date()) {
  await ensureDataDirs();
  const dir = path.join(uploadsRoot, format(date, "yyyy/MM/dd"));
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveIncomingFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const ext = path.extname(file.name);
  const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 80) || "upload";
  const storedFilename = `${Date.now()}-${safeBase}-${hash.slice(0, 12)}${ext}`;
  const dir = await ensureUploadDayDir();
  const fullPath = path.join(dir, storedFilename);
  await writeFile(fullPath, buffer);

  return {
    fullPath,
    storedFilename,
    extension: ext.replace(/^\./, "") || null,
    sizeBytes: BigInt(buffer.byteLength),
    sha256: hash,
  };
}

export async function appendMessageLog(args: {
  messageId: string;
  content: string;
  device: ParsedDevice;
  createdAt?: Date;
}) {
  await ensureDataDirs();
  const timestamp = args.createdAt ?? new Date();
  const day = format(timestamp, "yyyy-MM-dd");
  const logPath = path.join(messagesRoot, `${day}.log`);
  const entry = {
    messageId: args.messageId,
    timestamp: timestamp.toISOString(),
    sourceIp: args.device.sourceIp,
    userAgent: args.device.userAgent,
    deviceType: args.device.deviceType,
    deviceVendor: args.device.deviceVendor,
    deviceModel: args.device.deviceModel,
    browserName: args.device.browserName,
    browserVersion: args.device.browserVersion,
    osName: args.device.osName,
    osVersion: args.device.osVersion,
    tailscaleUser: args.device.tailscaleUser,
    tailscaleLogin: args.device.tailscaleLogin,
    tailscaleNode: args.device.tailscaleNode,
    tailscaleTailnet: args.device.tailscaleTailnet,
    content: args.content,
  };
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  return logPath;
}
