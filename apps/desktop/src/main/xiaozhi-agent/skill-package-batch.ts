/** Independent package proofs share a small IO batch; every launched proof settles
 * before a failure escapes, and successful results retain the caller's order. */
export async function mapSkillPackages<T, R>(items: readonly T[], verify: (item: T, index: number) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const values: R[] = [];
  signal?.throwIfAborted();
  for (let offset = 0; offset < items.length; offset += 4) {
    signal?.throwIfAborted();
    const settled = await Promise.allSettled(items.slice(offset, offset + 4).map(async (item, index) => {
      signal?.throwIfAborted();
      return verify(item, offset + index);
    }));
    signal?.throwIfAborted();
    for (const result of settled) {
      if (result.status === 'rejected') throw result.reason;
      values.push(result.value);
    }
  }
  return values;
}
