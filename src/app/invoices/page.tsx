"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Invoices were merged into the Sales & Invoices page at /sales */
export default function InvoicesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sales");
  }, [router]);
  return null;
}
