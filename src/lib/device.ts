import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";

export type ParsedDevice = {
  sourceIp: string | null;
  userAgent: string | null;
  deviceType: string | null;
  deviceVendor: string | null;
  deviceModel: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  tailscaleUser: string | null;
  tailscaleLogin: string | null;
  tailscaleNode: string | null;
  tailscaleTailnet: string | null;
};

export async function parseRequestDevice(): Promise<ParsedDevice> {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const ipHeader =
    requestHeaders.get("x-forwarded-for") ?? requestHeaders.get("x-real-ip");
  const sourceIp = ipHeader?.split(",")[0]?.trim() ?? null;
  const ua = userAgent ? new UAParser(userAgent).getResult() : undefined;

  return {
    sourceIp,
    userAgent: userAgent ?? null,
    deviceType: ua?.device?.type ?? (ua ? "desktop" : null),
    deviceVendor: ua?.device?.vendor ?? null,
    deviceModel: ua?.device?.model ?? null,
    browserName: ua?.browser?.name ?? null,
    browserVersion: ua?.browser?.version ?? null,
    osName: ua?.os?.name ?? null,
    osVersion: ua?.os?.version ?? null,
    tailscaleUser: requestHeaders.get("tailscale-user") ?? null,
    tailscaleLogin: requestHeaders.get("tailscale-login") ?? null,
    tailscaleNode: requestHeaders.get("tailscale-node") ?? null,
    tailscaleTailnet: requestHeaders.get("tailscale-tailnet") ?? null,
  };
}

export function formatDeviceLabel(device: Partial<ParsedDevice>) {
  const type = device.deviceType ?? "unknown";
  const browser = device.browserName ?? "Unknown Browser";
  const os = device.osName ?? "Unknown OS";
  const model = [device.deviceVendor, device.deviceModel].filter(Boolean).join(" ");
  return [type, model || null, `${browser} · ${os}`].filter(Boolean).join(" · ");
}
