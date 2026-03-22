export const APP_BASE_PATH = "/kipdok";

export const LOGIN_ROUTE = "/login";
export const INBOX_ROUTE = "/inbox";
export const UPLOAD_ROUTE = "/upload";
export const DASHBOARD_ROUTE = "/dashboard";

export const LOGIN_PATH = `${APP_BASE_PATH}${LOGIN_ROUTE}`;
export const INBOX_PATH = `${APP_BASE_PATH}${INBOX_ROUTE}`;
export const UPLOAD_PATH = `${APP_BASE_PATH}${UPLOAD_ROUTE}`;
export const DASHBOARD_PATH = `${APP_BASE_PATH}${DASHBOARD_ROUTE}`;
export const SESSION_API_PATH = `${APP_BASE_PATH}/api/session`;
export const LOGIN_API_PATH = `${APP_BASE_PATH}/api/auth/login`;
export const LOGOUT_API_PATH = `${APP_BASE_PATH}/api/auth/logout`;
export const MESSAGES_API_PATH = `${APP_BASE_PATH}/api/messages`;
export const FILES_API_PATH = `${APP_BASE_PATH}/api/files`;
export const ITEMS_API_PATH = `${APP_BASE_PATH}/api/items`;
export const NETWORK_PROFILE_API_PATH = `${APP_BASE_PATH}/api/network-profile`;
export const DASHBOARD_EVENTS_API_PATH = `${APP_BASE_PATH}/api/dashboard/events`;

function normalizeRoute(pathname: string) {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function buildAppRoute(pathname: string) {
  return normalizeRoute(pathname);
}

export function buildAppPath(pathname: string) {
  return `${APP_BASE_PATH}${normalizeRoute(pathname)}`;
}

export function buildItemPath(id: string) {
  return buildAppPath(`/items/${id}`);
}

export function buildItemRoute(id: string) {
  return buildAppRoute(`/items/${id}`);
}

export function buildItemApiPath(id: string) {
  return buildAppPath(`/api/items/${id}`);
}

export function buildFileDownloadPath(id: string) {
  return buildAppPath(`/api/files/${id}/download`);
}

export function buildRequestUrl(request: Request, pathname: string) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const protocol = forwardedProto ?? (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  if (host) {
    return new URL(pathname, `${protocol}://${host}`);
  }

  return new URL(pathname, request.url);
}
