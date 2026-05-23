// Deterministic-ish randomness for mock partner adapters. Latency simulator
// stays small enough to feel real without slowing the tool roundtrip.

export function code(prefix: string, len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${out}`;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function latency(min = 200, max = 800): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}
