import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATA_ROOT: z.string().default("./data"),
  SESSION_SECRET: z.string().min(32),
  INITIAL_ADMIN_USERNAME: z.string().min(1),
  INITIAL_ADMIN_PASSWORD: z.string().min(8),
  APP_NAME: z.string().default("Kipdok"),
  APP_BASE_URL: z.string().url().default("http://127.0.0.1:3000/kipdok"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(100),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATA_ROOT: process.env.DATA_ROOT,
  SESSION_SECRET: process.env.SESSION_SECRET,
  INITIAL_ADMIN_USERNAME: process.env.INITIAL_ADMIN_USERNAME,
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD,
  APP_NAME: process.env.APP_NAME,
  APP_BASE_URL: process.env.APP_BASE_URL,
  MAX_UPLOAD_SIZE_MB: process.env.MAX_UPLOAD_SIZE_MB,
});

export const dataRoot = path.resolve(env.DATA_ROOT);
export const uploadsRoot = path.join(dataRoot, "uploads");
export const messagesRoot = path.join(dataRoot, "messages");
export const logsRoot = path.join(dataRoot, "logs");
export const dbRoot = path.join(dataRoot, "db");
export const exportsRoot = path.join(dataRoot, "export");

export async function ensureDataDirs() {
  const dirs = [dataRoot, uploadsRoot, messagesRoot, logsRoot, dbRoot, exportsRoot];

  await Promise.all(
    dirs.map(async (dir) => {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }),
  );
}
