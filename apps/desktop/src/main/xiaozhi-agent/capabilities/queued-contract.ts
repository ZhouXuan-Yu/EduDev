import type {JournalOwner} from '../events/journal';

/** Cancellation is checked inside the publisher queue without throwing there:
 * a known late admission is not a failed journal transaction. Real writes still
 * propagate their errors through the publisher's permanent failure gate. */
export async function persistCurrentToolContract(options: {
  signal?: AbortSignal;
  current: () => boolean;
  enqueue: (current: () => boolean, write: (owner: JournalOwner) => Promise<void>) => Promise<boolean>;
  write: (owner: JournalOwner) => Promise<void>;
}) {
  const current = () => !options.signal?.aborted && options.current();
  if (!current()) throw Error('cancelled');
  const written = await options.enqueue(current, options.write);
  if (!written || !current()) throw Error('cancelled');
}
