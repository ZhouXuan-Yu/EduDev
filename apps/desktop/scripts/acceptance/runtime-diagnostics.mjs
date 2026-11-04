/** Collect only the host's bounded diagnostic codes, never raw process output. */
export function captureRuntimeDiagnostics(app, report, persist) {
  let pending = '';
  const onData = chunk => {
    pending = (pending + String(chunk)).slice(-16384);
    const lines = pending.split(/\r?\n/); pending = lines.pop() ?? '';
    for (const line of lines) {
      const match = /^\[xiaozhi-(journal|cancel)\] (\{.*\})$/.exec(line);
      if (!match) continue;
      try {
        const raw = JSON.parse(match[2]), item = {kind: match[1]};
        for (const key of ['code','type','nativeCode','tool','source'])
          if (typeof raw[key] === 'string' && /^[A-Za-z_]{1,128}$/.test(raw[key])) item[key] = raw[key];
        if (typeof raw.runId === 'string' && /^run_[a-f0-9-]{36}$/i.test(raw.runId)) item.runId = raw.runId;
        if (Number.isSafeInteger(raw.timeoutMs) && raw.timeoutMs > 0) item.timeoutMs = raw.timeoutMs;
        (report.runtimeDiagnostics ??= []).push(item);
        report.runtimeDiagnostics = report.runtimeDiagnostics.slice(-40);
        persist();
      } catch { /* Malformed or unrelated log lines cannot become evidence. */ }
    }
  };
  app.process().stderr?.on('data', onData);
  return () => app.process().stderr?.off('data', onData);
}
