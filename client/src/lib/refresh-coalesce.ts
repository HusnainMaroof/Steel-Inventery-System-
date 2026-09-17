/** Coalesce concurrent refresh calls into one in-flight request. */
export function createCoalescedRefresh(run: () => Promise<void>) {
  let inflight: Promise<void> | null = null;
  return () => {
    if (inflight) return inflight;
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
