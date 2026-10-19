"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAuth } from "@/lib/auth";
import { businessPath } from "@/lib/business-path";
import { canOpenPath } from "@/lib/staff-access";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** Render nothing (instead of plain text) when the plan or staff access blocks the page. */
  hideWhenBlocked?: boolean;
};

/** Tenant link — prefixes the signed-in business slug automatically. */
export function BusinessLink({ href, hideWhenBlocked = false, ...props }: Props) {
  const { user, ready } = useAuth();
  const canOpen = useCanOpenPage();
  const page = href.startsWith("/") ? href.slice(1) : href;
  if (!ready) {
    return (
      <span {...props} aria-busy="true">
        {props.children}
      </span>
    );
  }
  // A page the plan or staff access does not include: no link to a page that would bounce.
  if (!canOpen(href)) {
    if (hideWhenBlocked) return null;
    return <span>{props.children}</span>;
  }
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

/** Whether the signed-in user's plan and staff access include a business page ("/payments", "/sales?tab=dues"). */
export function useCanOpenPage() {
  const { user } = useAuth();
  const businessHref = useBusinessHref();
  return (page: string) => {
    if (!user || user.role === "SUPERADMIN") return true;
    const path = businessHref(page).split(/[?#]/)[0];
    return canOpenPath(user, path);
  };
}
