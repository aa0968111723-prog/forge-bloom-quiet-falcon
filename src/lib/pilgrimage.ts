import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export const loadPilgrimage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ visited: unknown; play_seconds: number }>`
      select visited, play_seconds from pilgrimage where user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) return { visited: [] as string[], playSeconds: 0 };
    const visited = Array.isArray(row.visited)
      ? (row.visited as string[])
      : typeof row.visited === "string"
        ? (JSON.parse(row.visited) as string[])
        : [];
    return { visited, playSeconds: row.play_seconds };
  });

export const savePilgrimage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { visited: string[]; playSeconds: number }) => ({
    visited: data.visited.filter((id) => typeof id === "string").slice(0, 20),
    playSeconds: Math.max(0, Math.min(1_000_000, Math.floor(data.playSeconds))),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const payload = JSON.stringify(data.visited);
    await sql.query(
      `insert into pilgrimage (user_id, visited, play_seconds, updated_at)
       values ($1, $2::jsonb, $3, now())
       on conflict (user_id) do update set
         visited = excluded.visited,
         play_seconds = excluded.play_seconds,
         updated_at = now()`,
      [context.userId, payload, data.playSeconds],
    );
    return { ok: true as const };
  });
