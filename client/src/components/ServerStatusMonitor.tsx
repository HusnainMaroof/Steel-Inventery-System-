"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { OFFLINE_PATH, probeAppHealth, redirectToOfflinePage } from "@/lib/server-offline";
import { createStatusCheck } from "@/lib/server-status-monitor";

const SKIP_PREFIXES = [OFFLINE_PATH, "/404", "/api"];

/**
 * Checks app health once on mount, then again only when the tab regains focus
 * or becomes visible. There is no timer, so idle tabs make no requests.
 * API failures already redirect to the offline page in lib/api.ts.
 */
export function ServerStatusMonitor() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const skip = !pathname || SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (skip) return;

    let active = true;
    const check = createStatusCheck({
      probe: probeAppHealth,
      onUnavailable: () => {
        if (active) redirectToOfflinePage(pathnameRef.current);
      },
      now: () => Date.now(),
    });

    const onFocus = () => void check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [skip]);

  return null;
}
