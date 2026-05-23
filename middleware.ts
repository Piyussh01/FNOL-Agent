import { NextResponse, type NextRequest } from "next/server";

// Stub. Rate limiting (Upstash) is wired in M16.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect everything except static assets + favicon. Refined in M16.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/.*).*)",
  ],
};
