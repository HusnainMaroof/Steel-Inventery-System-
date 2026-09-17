"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBusinessHref } from "@/components/BusinessLink";
import RouteSkeleton from "@/components/RouteSkeleton";

export default function InvoicesRedirect() {
  const router = useRouter();
  const href = useBusinessHref();
  useEffect(() => {
    router.replace(href("sales"));
  }, [router, href]);
  return <RouteSkeleton />;
}
