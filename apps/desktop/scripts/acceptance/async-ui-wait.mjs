export const DEFAULT_ASYNC_UI_TIMEOUT_MS = 30_000;

/** Host-side polling awaits each renderer result within the original total budget.
 * Callers use this as a completion barrier and do not consume a JSHandle.
 */
export async function waitForAsyncUi(page, predicate, argument, {timeout = DEFAULT_ASYNC_UI_TIMEOUT_MS} = {}) {
  let stopped = false, deadlineTimer, pollingTimer, resumePolling;
  const error = new Error(`waitForAsyncUi: Timeout ${timeout}ms exceeded waiting for the awaited predicate`);
  error.name = 'TimeoutError';
  const deadline = new Promise((_, reject) => {
    if (timeout !== 0) deadlineTimer = setTimeout(() => {stopped = true; reject(error);}, timeout);
  });
  const poll = async () => {
    while (!stopped) {
      const result = await page.evaluate(predicate, argument);
      if (stopped) throw error;
      if (Boolean(result)) return;
      await new Promise(resolve => {resumePolling = resolve; pollingTimer = setTimeout(resolve, 16);});
    }
    throw error;
  };
  try {await Promise.race([poll(), deadline]);}
  finally {stopped = true; clearTimeout(deadlineTimer); clearTimeout(pollingTimer); resumePolling?.();}
}
