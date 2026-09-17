"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBusinessHref } from "@/components/BusinessLink";

export default function ProfitRedirect() {
  const router = useRouter();
  const href = useBusinessHref();
  useEffect(() => {
    router.replace(href("reports"));
  }, [router, href]);
  return null;
}
