import {AsyncLocalStorage} from 'node:async_hooks';
import type {Sql} from './session-state';

/** Queue before opening another writer connection. Waiting BEGIN IMMEDIATE calls
 * must not occupy libuv's workers needed by the current transaction's SQL/IO.
 * Work inside the transaction uses its original same-connection adapter. */
export function serializeStateWrites(source: Sql): Sql {
  let tail: Promise<void> = Promise.resolve();
  const fallbackContext = new AsyncLocalStorage<{work: Sql; active: boolean}>();
  const currentWork = () => {
    const context = fallbackContext.getStore();
    return context?.active ? context.work : undefined;
  };
  function write<T>(action: () => Promise<T>): Promise<T> {
    const pending = tail.then(action);
    tail = pending.then(() => undefined, () => undefined);
    return pending;
  }
  return {
    ...(source.readTransaction ? {readTransaction: <T>(action: (work: Sql) => Promise<T>) => {
      const work = currentWork();
      return work ? action(work) : source.readTransaction!(action);
    }} : {}),
    all: (...args) => {
      const work = currentWork();
      if (work) return work.all(...args);
      // A native adapter owns its reader isolation. The fallback shares one connection.
      if (source.transaction) return source.all(...args);
      return write(() => source.all(...args));
    },
    run: (...args) => {
      const work = currentWork();
      return work ? work.run(...args) : write(() => source.run(...args));
    },
    ...(source.change ? {
      change: (...args: Parameters<NonNullable<Sql['change']>>) => {
        const work = currentWork();
        return work ? work.change!(...args) : write(() => source.change!(...args));
      },
    } : {}),
    transaction: <T>(action: (work: Sql) => Promise<T>) => {
      const work = currentWork();
      if (work) return action(work);
      return write(async () => {
        if (source.transaction) return source.transaction(action);
        const context = {work: source, active: true};
        await source.run('BEGIN IMMEDIATE');
        try {
          const result = await fallbackContext.run(context, () => action(source));
          await source.run('COMMIT');
          return result;
        } catch (error) {
          await source.run('ROLLBACK');
          throw error;
        } finally {
          context.active = false;
        }
      });
    },
  };
}
