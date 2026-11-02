/** Await actual predicate values in Node. Installed Playwright treats an async predicate's Promise
 * as truthy inside waitForFunction, including promises whose eventual value is false.
 */
export async function waitInstanceCondition(page, predicate, argument, {timeout = 30000, description = 'B UI condition'} = {}) {
  let expired = false, timer;
  const error = new Error(`${description}: no awaited true result within ${timeout}ms`);
  error.name = 'TimeoutError';
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {expired = true; reject(error);}, timeout);
  });
  const poll = async () => {
    while (!expired) {
      const result = await page.evaluate(predicate, argument);
      if (expired) throw error;
      if (result === true) return;
      if (result !== false) throw new TypeError(description + ': predicate must resolve to a boolean');
      // Yield to real rendering, without a fixed sleep or overlapping host reads.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
    }
    throw error;
  };
  try {await Promise.race([poll(), deadline]);}
  finally {expired = true; clearTimeout(timer);}
}
