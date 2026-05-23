import { NextResponse, type NextRequest } from "next/server";
import { check } from "@/lib/observability/ratelimit";

const RATE_KEY_BY_PREFIX: Array<[string, "conv" | "tools" | "chat"]> = [
  ["/api/conversations/", "conv"],
  ["/api/tools/", "tools"],
  ["/api/chat/", "chat"],
];

function ipFrom(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  for (const [prefix, kind] of RATE_KEY_BY_PREFIX) {
    if (path.startsWith(prefix)) {
      const ip = ipFrom(req);
      const { allowed, remaining } = await check(kind, ip);
      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "rate_limited" }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "x-ratelimit-remaining": String(remaining ?? 0),
            },
          },
        );
      }
      break;
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/conversations/:path*", "/api/tools/:path*", "/api/chat/:path*"],
};
