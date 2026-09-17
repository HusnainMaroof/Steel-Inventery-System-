"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAuth } from "@/lib/auth";
import { businessPath } from "@/lib/business-path";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** Tenant link — prefixes the signed-in business slug automatically. */
export function BusinessLink({ href, ...props }: Props) {
  const { user } = useAuth();
  const page = href.startsWith("/") ? href.slice(1) : href;
  const target =
    user?.businessSlug && user.role !== "SUPERADMIN"
      ? businessPath(user.businessSlug, page)
      : `/${page}`;
  return <Link href={target} {...props} />;
}

export function useBusinessHref() {
  const { user } = useAuth();
  return (page: string) => {
    const clean = page.replace(/^\/+/, "");
    if (user?.businessSlug && user.role !== "SUPERADMIN") {
      return businessPath(user.businessSlug, clean);
    }
    return `/${clean}`;
  };
}
