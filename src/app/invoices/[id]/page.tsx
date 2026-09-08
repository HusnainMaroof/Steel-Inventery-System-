"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/* Printable invoice pages moved to /sales/[id] — keep old links working */
export default function InvoiceRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (params.id) router.replace(`/sales/${params.id}`);
  }, [router, params.id]);
  return null;
}
