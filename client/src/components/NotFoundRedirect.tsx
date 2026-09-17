"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { NotFoundScreen } from "@/components/NotFoundScreen";
import { NOT_FOUND_PATH, redirectToNotFoundPage } from "@/lib/not-found-route";

export function NotFoundRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith(NOT_FOUND_PATH)) return;
    redirectToNotFoundPage(pathname);
  }, [pathname]);

  return <NotFoundScreen />;
}
