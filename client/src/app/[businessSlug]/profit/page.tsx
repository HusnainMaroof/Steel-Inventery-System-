"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBusinessHref } from "@/components/BusinessLink";
import RouteSkeleton from "@/components/RouteSkeleton";

export default function ProfitRedirect() {
  const router = useRouter();
  const href = useBusinessHref();
  useEffect(() => {
    router.replace(href("reports"));
  }, [router, href]);
  return <RouteSkeleton />;
}
