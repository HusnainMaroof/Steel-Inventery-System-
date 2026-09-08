"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Profit & Loss now lives inside Reports & Profit at /reports */
export default function ProfitRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reports");
  }, [router]);
  return null;
}
