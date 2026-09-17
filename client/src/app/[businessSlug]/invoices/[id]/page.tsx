"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { businessPath } from "@/lib/business-path";

/* Printable invoice pages moved to /sales/[id] — keep old links working */
export default function InvoiceRedirect() {
  const params = useParams<{ businessSlug: string; id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (params.id && params.businessSlug) {
      router.replace(businessPath(params.businessSlug, `sales/${params.id}`));
    }
  }, [router, params.id, params.businessSlug]);
  return null;
}
