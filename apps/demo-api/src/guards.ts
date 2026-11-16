/**
 * What keeps a free public endpoint from being run into the ground: a budget
 * per client, and a cache so the same question is not asked of the RPC
 * endpoint twice in a row. Both live in memory and both are bounded.
 */

/**
 * A token bucket per client: `perMinute` points refill evenly over a minute, up to `burst`. A route costs points
 * (a holder map costs more than a quote).
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { points: number; at: number }>();

  constructor(
    private readonly perMinute: number,
    private readonly burst: number = perMinute,
    private readonly now: () => number = Date.now,
    private readonly maxClients = 50_000,
  ) {}

  /** Null when the client may go on (the cost is taken); otherwise the seconds until it may. */
  take(client: string, cost = 1): number | null {
    const at = this.now();
    const bucket = this.buckets.get(client) ?? { points: this.burst, at };
    const points = Math.min(this.burst, bucket.points + ((at - bucket.at) / 60_000) * this.perMinute);
    if (points < cost) {
      this.buckets.set(client, { points, at });
      return Math.max(1, Math.ceil(((cost - points) / this.perMinute) * 60));
    }
    this.buckets.delete(client);
    this.buckets.set(client, { points: points - cost, at });
    if (this.buckets.size > this.maxClients) {
      // The clients heard from longest ago go first; a full bucket is what a forgotten client gets back anyway.
      let drop = Math.ceil(this.maxClients / 10);
      for (const key of this.buckets.keys()) {
        this.buckets.delete(key);
        if (--drop <= 0) break;
      }
    }
    return null;
  }
}

interface Entry {
  readonly value: Promise<unknown>;
  readonly expiresAt: number;
}

/**
 * Answers kept for a short time, by key. Two callers asking the same thing at once share one read. A read that
 * fails is not kept.
 */
export class TtlCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxEntries = 5_000,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string, ttlMs: number, read: () => Promise<T>): Promise<T> {
    const at = this.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > at) return hit.value as Promise<T>;
    const value = read();
    const entry: Entry = { value, expiresAt: at + ttlMs };
    this.entries.delete(key);
    this.entries.set(key, entry);
    value.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    if (this.entries.size > this.maxEntries) {
      let drop = Math.ceil(this.maxEntries / 10);
      for (const k of this.entries.keys()) {
        this.entries.delete(k);
        if (--drop <= 0) break;
      }
    }
    return value;
  }

  get size(): number {
    return this.entries.size;
  }
}
