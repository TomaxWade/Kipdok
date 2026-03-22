import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { APP_BASE_PATH, buildRequestUrl, INBOX_PATH, LOGIN_API_PATH, LOGIN_PATH } from "@/lib/routes";

const publicPrefixes = [LOGIN_PATH, LOGIN_API_PATH];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(?:png|jpg|jpeg|svg|ico|webp|css|js)$/)
  ) {
    return NextResponse.next();
  }

  if (pathname === APP_BASE_PATH) {
    return NextResponse.redirect(buildRequestUrl(request, LOGIN_PATH));
  }

  const isPublic = publicPrefixes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isProtectedDropboxRoute = pathname.startsWith(`${APP_BASE_PATH}/`) || pathname === APP_BASE_PATH;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (isProtectedDropboxRoute && !hasSessionCookie && !isPublic) {
    return NextResponse.redirect(buildRequestUrl(request, LOGIN_PATH));
  }

  if (hasSessionCookie && pathname === LOGIN_PATH) {
    return NextResponse.redirect(buildRequestUrl(request, INBOX_PATH));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
