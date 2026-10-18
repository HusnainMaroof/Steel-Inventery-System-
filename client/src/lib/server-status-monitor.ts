/** Minimum gap between two status probes, so focus and visibility events do not spam the API. */
export const STATUS_CHECK_MIN_INTERVAL_MS = 60_000;

export interface StatusCheckDeps {
  /** Resolves true when the app server answers. */
  probe: () => Promise<boolean>;
  /** Called only when a probe reports the server as unavailable. */
  onUnavailable: () => void;
  now: () => number;
}

/**
 * Builds a check function that:
 * - shares one in-flight probe between concurrent triggers,
 * - skips a new probe if the last one started less than the minimum interval ago.
 */
export function createStatusCheck(deps: StatusCheckDeps): () => Promise<void> {
  let inflight: Promise<void> | null = null;
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  return () => {
    if (inflight) return inflight;
    if (deps.now() - lastStartedAt < STATUS_CHECK_MIN_INTERVAL_MS) {
      return Promise.resolve();
    }
    lastStartedAt = deps.now();
    inflight = deps
      .probe()
      .then((ok) => {
        if (!ok) deps.onUnavailable();
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}
