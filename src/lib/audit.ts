import { prisma } from "@/lib/prisma";
import type { ParsedDevice } from "@/lib/device";

export type EventAction =
  | "login"
  | "logout"
  | "upload_message"
  | "upload_file"
  | "download_file"
  | "view_item"
  | "delete_item";

export async function upsertDeviceInfo(device: ParsedDevice) {
  return prisma.deviceInfo.create({
    data: {
      sourceIp: device.sourceIp,
      userAgent: device.userAgent,
      deviceType: device.deviceType,
      deviceVendor: device.deviceVendor,
      deviceModel: device.deviceModel,
      browserName: device.browserName,
      browserVersion: device.browserVersion,
      osName: device.osName,
      osVersion: device.osVersion,
      tailscaleUser: device.tailscaleUser,
      tailscaleLogin: device.tailscaleLogin,
      tailscaleNode: device.tailscaleNode,
      tailscaleTailnet: device.tailscaleTailnet,
    },
  });
}

export async function recordEvent(args: {
  action: EventAction;
  itemId?: string;
  deviceInfoId?: string;
  detail?: string;
}) {
  return prisma.accessEvent.create({
    data: {
      action: args.action,
      itemId: args.itemId,
      deviceInfoId: args.deviceInfoId,
      detail: args.detail,
    },
  });
}

export const itemInclude = {
  message: true,
  fileAsset: true,
  deviceInfo: true,
} as const;
