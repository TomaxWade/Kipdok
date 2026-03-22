import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { LOGIN_PATH } from "@/lib/routes";

export const SESSION_COOKIE_NAME = "tailscale_inbox_session";
const SESSION_TTL_DAYS = 30;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function shouldUseSecureCookie() {
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  const origin = requestHeaders.get("origin");
  if (origin) {
    try {
      return new URL(origin).protocol === "https:";
    } catch {}
  }

  const referer = requestHeaders.get("referer");
  if (referer) {
    try {
      return new URL(referer).protocol === "https:";
    } catch {}
  }

  return false;
}

async function hashAdminPassword() {
  return argon2.hash(env.INITIAL_ADMIN_PASSWORD, {
    type: argon2.argon2id,
  });
}

export async function ensureAdminUser() {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.adminUser.findUnique({
      where: { username: env.INITIAL_ADMIN_USERNAME },
    });

    if (existing) {
      const passwordMatches = await argon2.verify(existing.passwordHash, env.INITIAL_ADMIN_PASSWORD);
      if (passwordMatches) {
        return existing;
      }

      return tx.adminUser.update({
        where: { id: existing.id },
        data: {
          passwordHash: await hashAdminPassword(),
        },
      });
    }

    const existingUsers = await tx.adminUser.findMany({
      select: { id: true },
      take: 2,
    });

    if (existingUsers.length === 1) {
      return tx.adminUser.update({
        where: { id: existingUsers[0].id },
        data: {
          username: env.INITIAL_ADMIN_USERNAME,
          passwordHash: await hashAdminPassword(),
        },
      });
    }

    return tx.adminUser.create({
      data: {
        username: env.INITIAL_ADMIN_USERNAME,
        passwordHash: await hashAdminPassword(),
      },
    });
  });
}

export async function verifyAdminCredentials(username: string, password: string) {
  await ensureAdminUser();

  const user = await prisma.adminUser.findUnique({
    where: { username },
  });

  if (!user) {
    return null;
  }

  const valid = await argon2.verify(user.passwordHash, password);
  return valid ? user : null;
}

export async function createSession(adminUserId: string) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  const secureCookie = await shouldUseSecureCookie();

  await prisma.session.create({
    data: {
      adminUserId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    expires: expiresAt,
  });

  return rawToken;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    await prisma.session.deleteMany({
      where: { tokenHash: sha256(rawToken) },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = sha256(rawToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { adminUser: true },
  });

  if (!session || session.expiresAt < new Date()) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastAccessedAt: new Date() },
  });

  return session;
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect(LOGIN_PATH);
  }
  return session;
}
