/**
 * Pure helpers for merging server responses into local ledger state.
 * No React imports, so they can be unit tested with `node --test`.
 */

type Identified = { id: string };

/**
 * Insert or replace one record by id. Used to merge an authoritative server
 * response into a local collection without duplicating existing rows.
 * The input array is never mutated.
 */
export function upsertById<T extends Identified>(list: T[], record: T): T[] {
  const index = list.findIndex((item) => item.id === record.id);
  if (index === -1) return [...list, record];
  const next = list.slice();
  next[index] = record;
  return next;
}

/**
 * Remembers records applied locally after a server response (for example a
 * created customer). A fetch that started before such a write may resolve
 * without it, so the caller overlays every write recorded after that fetch
 * started. Writes older than a fetch are already contained in its response.
 */
export function createWriteLog() {
  let generation = 0;
  const entries: { gen: number; collection: string; record: Identified }[] = [];
  return {
    /** Current generation. Capture it before starting a fetch. */
    generation: () => generation,
    record<T extends Identified>(collection: string, record: T) {
      generation += 1;
      entries.push({ gen: generation, collection, record });
    },
    /** Records of one collection written after `startGen`. */
    since(startGen: number, collection: string): Identified[] {
      return entries
        .filter((entry) => entry.gen > startGen && entry.collection === collection)
        .map((entry) => entry.record);
    },
    clear() {
      entries.length = 0;
    },
  };
}

/** Apply recorded writes on top of a fetched list. */
export function overlayWrites<T extends Identified>(list: T[], writes: Identified[]): T[] {
  // Writes come from the same collection, so each record is a T.
  return writes.reduce<T[]>((acc, record) => upsertById(acc, record as T), list);
}

/**
 * Sequence guard for overlapping fetches. Only the most recently started
 * request may apply its response; older responses are dropped.
 */
export function createSequenceGuard() {
  let latest = 0;
  return {
    start(): number {
      latest += 1;
      return latest;
    },
    isLatest(token: number): boolean {
      return token === latest;
    },
  };
}

/**
 * Run a write, then reconcile local state.
 * - Write fails: the error is thrown and reconcile does not run.
 * - Write succeeds, reconcile fails: the write stays committed. The error is
 *   passed to `onReconcileError` and the result is still returned.
 */
export async function commitThenReconcile<T>(
  operation: () => Promise<T>,
  reconcile: () => Promise<unknown>,
  onReconcileError: (reason: unknown) => void,
): Promise<T> {
  const result = await operation();
  try {
    await reconcile();
  } catch (reason) {
    onReconcileError(reason);
  }
  return result;
}
