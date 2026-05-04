import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {

  const token = request.cookies.get("access_token")?.value;

  const { pathname } = request.nextUrl;

  const publicRoutes = [
    "/login",
    "/forgot-password",
    "/verify-otp",
    "/reset-password",
    "/reset-success"
  ];

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
  ],
};