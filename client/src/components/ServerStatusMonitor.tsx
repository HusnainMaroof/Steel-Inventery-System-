"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { OFFLINE_PATH, probeAppHealth, redirectToOfflinePage } from "@/lib/server-offline";

const SKIP_PREFIXES = [OFFLINE_PATH, "/404", "/api"];

export function ServerStatusMonitor() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    let cancelled = false;

    const check = async () => {
      const ok = await probeAppHealth();
      if (!cancelled && !ok) {
        redirectToOfflinePage(pathname);
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
