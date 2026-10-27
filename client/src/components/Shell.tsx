"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { useAuth, homeFor } from "@/lib/auth";
import { displayName, roleLabel } from "@/lib/auth-types";
import {
  businessSlugFromPath,
  legacyBusinessPath,
  pagePathFromBusinessRoute,
} from "@/lib/business-path";
import { MARKETING_PATHS, isPublicPath } from "@/lib/app-routes";
import { TenantSidebar, TenantSidebarContent } from "@/components/shell/TenantSidebar";
import { AdminShell, PLATFORM_ADMIN_NAV } from "@/components/shell/AdminShell";
import { canOpenPath, pagesFor } from "@/lib/staff-access";
import { useUiPreferences } from "@/lib/preferences";
import { AuthBootstrapSkeleton, skeletonForPath } from "@/components/skeletons";
import { ErrorState } from "@/components/ui";




type SidebarProps = Omit<ComponentProps<typeof TenantSidebarContent>, "layoutGroup" | "onNavigate">;

/** Phone layout: a slim top bar with the menu button, and the same sidebar in a drawer. */
function MobileNav({ sidebar }: { sidebar: SidebarProps }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    // display: contents keeps the sticky header scoped to the page, not to this wrapper.
    <div className="contents md:hidden">
      <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white/95 px-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="grid size-11 place-items-center rounded-xl text-ink transition-[background-color,scale] hover:bg-[#F4F4F2] active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 6h14M3 10h14M3 14h9" />
          </svg>
        </button>
        <Link href={sidebar.brandHref} aria-label={`${sidebar.brand} home`} className="flex min-w-0 justify-center px-2">
          {sidebar.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- business logos can be data URLs
            <img src={sidebar.logoSrc} alt={sidebar.brand} className="h-9 w-auto max-w-[160px] object-contain" />
          ) : (
            <span className="rounded-lg border border-dashed border-[#171717]/20 px-3 py-1.5 text-[13px] font-medium text-[#171717]/60">Your logo</span>
          )}
        </Link>
        <span className="size-11" aria-hidden />
      </header>
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              aria-label="Menu"
              className="fixed inset-y-2 left-2 z-50 w-[82vw] max-w-[300px] overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_24px_60px_-20px_rgba(17,17,17,0.35)]"
              initial={{ x: reduceMotion ? 0 : "-110%" }}
              animate={{ x: 0 }}
              exit={{ x: reduceMotion ? 0 : "-110%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <TenantSidebarContent {...sidebar} layoutGroup="drawer" onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, ready, logout, blockedMessage } = useAuth();
  const { prefs } = useUiPreferences();
  const router = useRouter();

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow as EventListener);
    return () => window.removeEventListener("pageshow", onShow as EventListener);
  }, []);

  const isMarketingRoute = MARKETING_PATHS.has(pathname ?? "");
  const isPublic = isPublicPath(pathname ?? "");
  const isAdminRoute = pathname === "/admin" || pathname?.startsWith("/admin/");
  const isMarketingPage = pathname === "/" || isMarketingRoute;
  const tenantPage = pagePathFromBusinessRoute(pathname ?? "") ?? "";
  const isPrintable =
    tenantPage.startsWith("/sales/") || tenantPage.startsWith("/invoices/");
  const roleHome = homeFor(user);

  useEffect(() => {
    if (!pathname || !ready || !user) return;
    if (isMarketingRoute) return;

    if (user.role === "SUPERADMIN") {
      if (pathname === "/" || pathname === "/login") router.replace("/admin/overview");
      else if (pathname === "/admin") router.replace("/admin/overview");
      else if (!isAdminRoute) router.replace("/admin/overview");
      return;
    }

    const legacy = legacyBusinessPath(pathname);
    if (legacy && user.businessSlug) {
      router.replace(`/${user.businessSlug}${legacy}`);
      return;
    }

    const slug = businessSlugFromPath(pathname);
    if (slug && slug !== user.businessSlug) {
      const rest = pagePathFromBusinessRoute(pathname) ?? "/dashboard";
      router.replace(`/${user.businessSlug}${rest}`);
      return;
    }

    if (pathname === "/" || pathname === "/login") {
      router.replace(roleHome);
      return;
    }

    if (isAdminRoute) {
      router.replace(roleHome);
      return;
    }

    if (!canOpenPath(user, pathname)) {
      router.replace(roleHome);
    }
  }, [pathname, user, ready, isAdminRoute, isMarketingRoute, roleHome, router]);

  const onSignOut = () => {
    void logout().then(() => {
      window.location.replace("/");
    });
  };

  if (!ready) {
    if (isPublic) return <>{children}</>;
    return <AuthBootstrapSkeleton />;
  }

  if (!user) {
    if (isPublic) return <>{children}</>;
    if (blockedMessage) {
      return (
        <ErrorState
          title="Access blocked"
          message={blockedMessage}
          onRetry={onSignOut}
          retryLabel="Sign out"
        />
      );
    }
    return null;
  }

  const brand =
    user.role === "SUPERADMIN"
      ? "Tijartt"
      : user.businessName?.trim() || user.name;
  const businessLogo = prefs.logoUrl.trim() || prefs.logoDataUrl.trim();
  const logoSrc =
    user.role === "SUPERADMIN"
      ? "/images/tijartt-logo.png"
      : businessLogo || null;

  const roleNav =
    user.role === "SUPERADMIN"
      ? PLATFORM_ADMIN_NAV
      : pagesFor(user);

  if (isMarketingPage) return <>{children}</>;
  if (pathname === "/login") return null;
  if (isPrintable) return <>{children}</>;

  const pendingRedirect =
    (user.role === "SUPERADMIN" && !isAdminRoute) ||
    (user.role !== "SUPERADMIN" && isAdminRoute) ||
    !canOpenPath(user, pathname);

  const mainContent = pendingRedirect
    ? skeletonForPath(user.role === "SUPERADMIN" ? pathname ?? "/admin/overview" : roleHome)
    : children;

  if (user.role === "SUPERADMIN") {
    return (
      <AdminShell user={user} pathname={pathname} onSignOut={onSignOut}>
        {mainContent}
      </AdminShell>
    );
  }

  const sidebar: SidebarProps = {
    items: roleNav.map((n) => ({ key: n.key, href: n.href, label: n.label })),
    pathname,
    brand,
    brandHref: roleHome,
    logoSrc,
    userName: displayName(user),
    userSubtitle: user.role === "SUBADMIN" ? roleLabel(user.role, user.title) : roleLabel(user.role),
    helpHref: "mailto:contact@tijartt.com",
    onSignOut,
  };

  return (
    <div className="min-h-screen md:flex">
      <TenantSidebar {...sidebar} />
      <MobileNav key={pathname} sidebar={sidebar} />
      <main className="min-w-0 flex-1 p-4 max-md:overflow-x-auto md:py-6 md:pr-6 md:pl-3 lg:pr-8">{mainContent}</main>
    </div>
  );
}
