// @ts-nocheck
// Hana 0.449.0, Apache-2.0; provenance in source-manifest.json.
function nonEmptyText(value: any): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function combinedSignal(local: AbortSignal, upstream: any): AbortSignal {
  if (!upstream || typeof upstream !== "object" || typeof upstream.aborted !== "boolean") {
    return local;
  }
  return AbortSignal.any([local, upstream]);
}

export class SessionExecutionRegistry {
  declare _activeBySessionId: Map<string, Map<symbol, any>>;

  constructor() {
    this._activeBySessionId = new Map();
  }

  begin({ sessionId, toolName = "tool", toolCallId = null, signal = null }: any = {}) {
    const stableSessionId = nonEmptyText(sessionId);
    if (!stableSessionId) throw new Error("SessionExecutionRegistry.begin requires sessionId");

    const controller = new AbortController();
    const key = Symbol(nonEmptyText(toolCallId) || nonEmptyText(toolName) || "tool");
    const entries = this._activeBySessionId.get(stableSessionId) || new Map();
    entries.set(key, {
      controller,
      toolName: nonEmptyText(toolName) || "tool",
      toolCallId: nonEmptyText(toolCallId),
    });
    this._activeBySessionId.set(stableSessionId, entries);

    let released = false;
    return {
      signal: combinedSignal(controller.signal, signal),
      release: () => {
        if (released) return;
        released = true;
        entries.delete(key);
        if (entries.size === 0) this._activeBySessionId.delete(stableSessionId);
      },
    };
  }

  abortBySession(sessionRef: any, reason = "session aborted") {
    const sessionId = nonEmptyText(sessionRef?.sessionId);
    if (!sessionId) throw new Error("SessionExecutionRegistry.abortBySession requires sessionId");
    const entries = this._activeBySessionId.get(sessionId);
    if (!entries) return { matched: 0, aborted: 0 };

    let aborted = 0;
    for (const entry of entries.values()) {
      if (entry.controller.signal.aborted) continue;
      entry.controller.abort(new Error(reason));
      aborted++;
    }
    return { matched: entries.size, aborted };
  }

  activeCount(sessionId: any) {
    const stableSessionId = nonEmptyText(sessionId);
    if (!stableSessionId) return 0;
    return this._activeBySessionId.get(stableSessionId)?.size || 0;
  }
}