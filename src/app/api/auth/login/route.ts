import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestTranslator } from "@/i18n/server";
import { createSession, verifyAdminCredentials } from "@/lib/auth";
import { parseRequestDevice } from "@/lib/device";
import { recordEvent, upsertDeviceInfo } from "@/lib/audit";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const t = await getRequestTranslator();
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: t("api.auth.enterCredentials") }, { status: 400 });
  }

  const user = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: t("api.auth.invalidCredentials") }, { status: 401 });
  }

  await createSession(user.id);
  const deviceInfo = await upsertDeviceInfo(await parseRequestDevice());
  await recordEvent({ action: "login", deviceInfoId: deviceInfo.id, detail: `login:${user.username}` });

  return NextResponse.json({ ok: true });
}
