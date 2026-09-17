/** Shared fetch timeout — prevents hung requests on slow bootstrap/report calls. */

export class FetchTimeoutError extends Error {
  readonly status = 504;
  constructor(ms: number) {
    super(`Request timed out after ${Math.round(ms / 1000)}s. Try again.`);
    this.name = "FetchTimeoutError";
  }
}

export function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof FetchTimeoutError ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
