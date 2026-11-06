import { setTimeout as delay } from "node:timers/promises";

export function isSqliteWriteLock(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    /^SQLITE_(?:BUSY|LOCKED)(?:_|$)/i.test(code) ||
    /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(message)
  );
}

export function sqliteWriteLockDelay(attempt: number) {
  return Math.min(250, 25 * 2 ** Math.min(attempt, 3));
}

/** Retry only lock acquisition. Callers own the transaction body and rollback. */
export async function beginMaterialWrite(
  exec: (sql: string) => Promise<unknown>,
  signal?: AbortSignal,
  foreignKeys = true,
) {
  signal?.throwIfAborted();
  const pragmas = foreignKeys ? "PRAGMA foreign_keys=ON; " : "";
  if (process.env.OMNI_EDU_MATERIAL_ASYNC_WRITE_LOCK === "0") {
    await exec(pragmas + "PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;");
    return;
  }
  await exec(pragmas + "PRAGMA busy_timeout=0;");
  const deadline = Date.now() + 10_000;
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      await exec("BEGIN IMMEDIATE;");
      return;
    } catch (error) {
      if (!isSqliteWriteLock(error)) throw error;
      if (Date.now() >= deadline) throw new Error("busy");
      await delay(
        Math.min(sqliteWriteLockDelay(attempt), deadline - Date.now()),
        undefined,
        { signal },
      );
    }
  }
}
