import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { parseRequestDevice } from "@/lib/device";
import { recordEvent, upsertDeviceInfo } from "@/lib/audit";
import { buildRequestUrl, LOGIN_PATH } from "@/lib/routes";

export async function POST(request: Request) {
  const deviceInfo = await upsertDeviceInfo(await parseRequestDevice());
  await recordEvent({ action: "logout", deviceInfoId: deviceInfo.id });
  await clearSession();
  return NextResponse.redirect(buildRequestUrl(request, LOGIN_PATH));
}
