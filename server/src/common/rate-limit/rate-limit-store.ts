/**
 * Pluggable rate-limit storage. Default: in-process Map (single instance).
 * Replace with Redis/Upstash implementation for horizontal scaling without
 * changing guard logic.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): number;
  prune(key: string, windowMs: number, now: number): number[];
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();

  hit(key: string, windowMs: number): number {
    const now = Date.now();
    const recent = this.prune(key, windowMs, now);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length;
  }

  prune(key: string, windowMs: number, now: number): number[] {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    this.hits.set(key, recent);
    return recent;
  }
}

export const rateLimitStore: RateLimitStore = new InMemoryRateLimitStore();
