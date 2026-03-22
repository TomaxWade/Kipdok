import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestTranslator } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { getNetworkProfileStatus, queueNetworkProfileSwitch } from "@/lib/network-profile";

export const runtime = "nodejs";

const schema = z.object({
  mode: z.enum(["open", "tailnet-only"]),
});

export async function GET() {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const status = await getNetworkProfileStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: t("api.network.invalidMode") }, { status: 400 });
  }

  try {
    queueNetworkProfileSwitch(parsed.data.mode);
    return NextResponse.json({ queued: true, targetMode: parsed.data.mode }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : t("api.network.switchFailed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
