import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Per-route rate limiters. No-op (always-allow) when Upstash env vars are
// missing, so dev / tests don't need Redis.

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

let memo: { conv: Ratelimit; tools: Ratelimit; chat: Ratelimit } | null = null;

function build() {
  const redis = getRedis();
  if (!redis) return null;
  memo = {
    conv: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "60 s"),
      prefix: "rl:conv",
    }),
    tools: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "rl:tools",
    }),
    chat: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "60 s"),
      prefix: "rl:chat",
    }),
  };
  return memo;
}

export async function check(
  kind: "conv" | "tools" | "chat",
  ip: string,
): Promise<{ allowed: boolean; remaining?: number }> {
  const limiters = memo ?? build();
  if (!limiters) return { allowed: true };
  const { success, remaining } = await limiters[kind].limit(ip);
  return { allowed: success, remaining };
}
