import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { getTrendSeries } from "@/lib/dashboard";

export async function GET(request: Request) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  return NextResponse.json(
    await getTrendSeries(searchParams.get("start") ?? undefined, searchParams.get("end") ?? undefined),
  );
}
