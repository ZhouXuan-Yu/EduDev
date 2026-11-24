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
  if (!signal && process.env.OMNI_EDU_MATERIAL_ASYNC_WRITE_LOCK === "0") {
    await exec(pragmas + "PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;");
    return;
  }
  await exec(pragmas + "PRAGMA busy_timeout=0;");
  await beginSqliteWrite(exec, signal);
}

/** Use a connection with busy_timeout=0 so waits stay outside the native pool. */
export async function beginSqliteWrite(
  exec: (sql: string) => Promise<unknown>,
  signal?: AbortSignal,
) {
  const deadline = performance.now() + 10_000;
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    if (performance.now() >= deadline) throw new Error("busy");
    try {
      await exec("BEGIN IMMEDIATE;");
    } catch (error) {
      if (!isSqliteWriteLock(error)) throw error;
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new Error("busy");
      try {
        await delay(Math.min(sqliteWriteLockDelay(attempt), remaining), undefined, { signal });
      } catch (waitError) {
        // Timers reject with AbortError; preserve the caller's cancellation reason for IPC.
        signal?.throwIfAborted();
        throw waitError;
      }
      continue;
    }
    if (signal?.aborted || performance.now() >= deadline) {
      await exec("ROLLBACK;");
      signal?.throwIfAborted();
      throw new Error("busy");
    }
    return;
  }
}
