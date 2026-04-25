import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware: only blocks truly public-only pages after login.
 * Dashboard protection is handled client-side by the dashboard layout
 * (AuthGuard) so we don't rely on cookie timing after window.location.replace.
 */
export function middleware(request: NextRequest) {
  // Just pass everything through — auth protection is client-side
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only run on dashboard routes (no-op, kept for future use)
    "/dashboard/:path*",
  ],
};