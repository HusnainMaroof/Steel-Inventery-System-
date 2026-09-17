"use client";

import { usePathname } from "next/navigation";
import { skeletonForPath } from "@/components/skeletons";

/** Path-aware loading placeholder for tenant and admin routes */
export default function RouteSkeleton() {
  const pathname = usePathname() ?? "";
  return skeletonForPath(pathname);
}
