import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/login", "/shared(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // All /api/* routes must implement their own authentication (token/session/Convex).
  // Middleware intentionally bypasses them.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return;
  }
  if (request.nextUrl.pathname === "/settings/agent-tokens") {
    return nextjsMiddlewareRedirect(request, "/settings/mcp-access");
  }
  if (!isPublicRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isPublicRoute(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
