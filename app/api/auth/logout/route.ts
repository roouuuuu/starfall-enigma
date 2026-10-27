import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { applySessionCookie, createSession, loadSession, requireCsrf } from "@/lib/auth";
import { handle } from "@/lib/http";

export const POST = handle(async (req: NextRequest) => {
  await requireCsrf(req);
  const { session, user } = await loadSession(req);
  const now = new Date().toISOString();

  if (user) {
    await run(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, created_at)
       VALUES (?, 'auth.logout', 'user', ?, '', ?)`,
      [Number(user.id), String(user.id), now]
    );
  }
  if (session) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [session.token_hash]);
  }

  const guest = await createSession(null);
  const response = NextResponse.json({ ok: true, redirect: "/" });
  applySessionCookie(response, guest.raw);
  return response;
});
