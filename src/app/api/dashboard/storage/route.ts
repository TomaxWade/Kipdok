import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { getStorageBreakdown } from "@/lib/dashboard";

export async function GET() {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  return NextResponse.json(await getStorageBreakdown());
}
