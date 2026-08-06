type WindowBucket = { windowStart: number; count: number };

function prune(bucket: WindowBucket, windowMs: number, now: number): WindowBucket {
  if (now - bucket.windowStart >= windowMs) {
    return { windowStart: now, count: 0 };
  }
  return bucket;
}

/**
 * Rate limit in-memory (un solo proceso). Para cluster, añadir Redis en el futuro.
 */
export class OpenAiSlidingWindowLimiter {
  private byKey = new Map<string, WindowBucket>();

  tryConsume(key: string, windowMs: number, maxInWindow: number, now = Date.now()): boolean {
    const prev = this.byKey.get(key) ?? { windowStart: now, count: 0 };
    const b = prune(prev, windowMs, now);
    if (b.count >= maxInWindow) {
      this.byKey.set(key, b);
      return false;
    }
    b.count += 1;
    this.byKey.set(key, b);
    return true;
  }
}

export const openAiRateLimiter = new OpenAiSlidingWindowLimiter();
