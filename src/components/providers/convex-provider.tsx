"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      // Für Build-Zeit: Kein Provider wenn keine URL
      return null;
    }
    return new ConvexReactClient(url);
  }, []);

  if (!convex) {
    // Während Build ohne Convex-URL: Render Kinder ohne Provider
    return <>{children}</>;
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
