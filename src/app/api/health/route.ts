import { connection } from "next/server";
import { getSql } from "@/server/db/client";
import { logger } from "@/server/log";

// Kiểm tra sức khỏe cho HEALTHCHECK của Docker (design D8): 200 khi truy vấn được DB, 503 khi không.

export async function GET(): Promise<Response> {
  await connection(); // luôn chạy lúc request, không prerender lúc build
  try {
    await getSql()`select 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.error({ event: "health_db_failed", err: err instanceof Error ? err.message : String(err) }, "health_db_failed");
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
