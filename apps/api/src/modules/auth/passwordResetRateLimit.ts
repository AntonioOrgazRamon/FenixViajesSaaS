const COOLDOWN_MS = 60_000; // 1 min entre envíos reales al mismo buzón
const WINDOW_MS = 60 * 60 * 1000; // 1h
const MAX_IN_WINDOW = 5;

const timestampsByEmail = new Map<string, number[]>();
const lastActionAt = new Map<string, number>();

export function notePasswordResetEvent(emailKey: string): void {
  const now = Date.now();
  const list = (timestampsByEmail.get(emailKey) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  timestampsByEmail.set(emailKey, list);
  lastActionAt.set(emailKey, now);
}

export function shouldBlockPasswordResetEmail(
  emailKey: string
): { blocked: true; reason: 'COOLDOWN' | 'HOUR_CAP' } | { blocked: false } {
  const now = Date.now();
  const last = lastActionAt.get(emailKey) || 0;
  if (now - last < COOLDOWN_MS) {
    return { blocked: true, reason: 'COOLDOWN' };
  }
  const list = (timestampsByEmail.get(emailKey) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_IN_WINDOW) {
    return { blocked: true, reason: 'HOUR_CAP' };
  }
  return { blocked: false };
}
