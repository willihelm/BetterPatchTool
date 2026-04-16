import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/login", "/shared(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const pathname = request.nextUrl.pathname;
  const pathWithQuery = `${pathname}${request.nextUrl.search}`;

  // All /api/* routes must implement their own authentication (token/session/Convex).
  // Middleware intentionally bypasses them.
  if (pathname.startsWith("/api/")) {
    return;
  }

  // OAuth metadata and token endpoints are intentionally public for MCP OAuth.
  if (
    pathname === "/token" ||
    pathname === "/register" ||
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname === "/.well-known/oauth-protected-resource"
  ) {
    return;
  }
  if (pathname === "/settings/agent-tokens") {
    return nextjsMiddlewareRedirect(request, "/settings/mcp-access");
  }
  if (!isPublicRoute(request) && !(await convexAuth.isAuthenticated())) {
    const loginUrl = `/login?redirectTo=${encodeURIComponent(pathWithQuery)}`;
    return nextjsMiddlewareRedirect(request, loginUrl);
  }
  if (isPublicRoute(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
