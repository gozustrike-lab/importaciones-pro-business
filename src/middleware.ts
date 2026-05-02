import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/register", "/api/auth", "/api/og"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Static files and API routes (except protected ones)
  const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/og-image") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname === "/";
  const isApiRoute = pathname.startsWith("/api");

  // Allow public routes, static files, and auth API routes
  if (isPublicRoute || isStaticFile) {
    return NextResponse.next();
  }

  // Allow NextAuth API routes
  if (isApiRoute && pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Get the JWT token (with fallback for missing NEXTAUTH_SECRET)
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch (error) {
    console.error("Middleware auth error:", error);
  }

  // If no token and not a public route, redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protected API routes: require authentication
  if (isApiRoute) {
    // Add tenantId to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", token.sub || "");
    requestHeaders.set("x-user-role", (token.role as string) || "TENANT_USER");
    requestHeaders.set("x-tenant-id", (token.tenantId as string) || "");

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
