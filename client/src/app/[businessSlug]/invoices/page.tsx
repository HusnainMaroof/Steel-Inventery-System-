"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBusinessHref } from "@/components/BusinessLink";

export default function InvoicesRedirect() {
  const router = useRouter();
  const href = useBusinessHref();
  useEffect(() => {
    router.replace(href("sales"));
  }, [router, href]);
  return null;
}
