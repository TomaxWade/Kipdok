import { NextResponse } from "next/server";
import { getRequestTranslator } from "@/i18n/server";
import { getCurrentSession } from "@/lib/auth";
import { getRecentEventsPage } from "@/lib/dashboard";

export async function GET(request: Request) {
  const t = await getRequestTranslator();
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? "0");
  const limit = Number(searchParams.get("limit") ?? "10");

  return NextResponse.json(
    await getRecentEventsPage(
      Number.isFinite(offset) && offset > 0 ? offset : 0,
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 20) : 10,
    ),
  );
}
