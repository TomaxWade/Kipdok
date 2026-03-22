import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { INBOX_PATH, LOGIN_PATH } from "@/lib/routes";

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? INBOX_PATH : LOGIN_PATH);
}
