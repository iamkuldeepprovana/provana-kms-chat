import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Allow access to login page
  if (request.nextUrl.pathname === "/login") {
    return NextResponse.next();
  }
  // Check for a session flag in localStorage (sent as cookie for SSR)
  const isLoggedIn = request.cookies.get("isLoggedIn")?.value === "true";
  if (!isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public directory
     * - login page
     */
    '/((?!_next/static|_next/image|favicon.ico|public|login).+)',
    '/',  // Also protect the root path
  ],
};
