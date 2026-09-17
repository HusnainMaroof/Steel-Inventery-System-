"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useAuth, homeFor, type AuthUser } from "@/lib/auth";
import { displayName, roleLabel } from "@/lib/auth-types";
import {
  businessSlugFromPath,
  legacyBusinessPath,
  pagePathFromBusinessRoute,
} from "@/lib/business-path";
import { canOpenPath, pagesFor } from "@/lib/staff-access";
import { useUiPreferences } from "@/lib/preferences";
import { AuthBootstrapSkeleton, skeletonForPath } from "@/components/skeletons";

const TRADEX_LOGO = "/images/logo.png";

const ICONS: Record<string, ReactNode> = {
  dashboard: <path d="M2 8.5 8 3l6 5.5V14a.5.5 0 0 1-.5.5h-3v-4h-3v4h-3A.5.5 0 0 1 2 14Z" />,
  purchases: <path d="M2 3h2l1.6 8.5a1 1 0 0 0 1 .8h5.9a1 1 0 0 0 1-.8L15 6H4.5M6.5 14.5h.01M11.5 14.5h.01" />,
  inventory: <path d="M3 5.5 8 3l5 2.5v5L8 13 3 10.5ZM3 5.5 8 8l5-2.5M8 8v5" />,
  products: <path d="M8 2 3 4.5v7L8 14l5-2.5v-7L8 2ZM3 4.5 8 7l5-2.5M8 7v7" />,
  sales: <path d="M3 2.5h10v11l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2ZM5.5 6h5M5.5 8.5h5" />,
  customers: <path d="M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 13.5c.7-2.2 3-3.5 5.5-3.5s4.8 1.3 5.5 3.5" />,
  suppliers: <path d="M2.5 13.5v-6l3-1.5v7.5M5.5 13.5h5v-9l-5 1.5M10.5 13.5h3v-4l-3-1.2M4 8.5h.01M7.5 9.5h.01" />,
  payments: <path d="M2 5.5h12v7H2ZM2 5.5 8 2.5l6 3M11.5 9h.01" />,
  expenses: <path d="M3 2.5h10v11H3ZM6 5.5h4M6 8h4M6 10.5h2.5" />,
  reports: <path d="M4 2.5h6l2.5 2.5v8.5H4ZM10 2.5V5h2.5M6 8h4M6 10.5h4" />,
  settings: <path d="M6.5 2.5h3l.6 1.6 1.5.6 1.4-.8 2.1 2.1-.8 1.4.6 1.5 1.6.6v3l-1.6.6-.6 1.5.8 1.4-2.1 2.1-1.4-.8-1.5.6-.6 1.6h-3l-.6-1.6-1.5-.6-1.4.8-2.1-2.1.8-1.4-.6-1.5L2 9.5v-3l1.6-.6.6-1.5-.8-1.4L5.5 1.9l1.4.8 1.5-.6ZM8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" />,
  staff: <path d="M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 13.5c.7-2.2 3-3.5 5.5-3.5s4.8 1.3 5.5 3.5M11.5 6.5h3M13 5v3" />,
  overview: <path d="M2 8.5 8 3l6 5.5V14a.5.5 0 0 1-.5.5h-3v-4h-3v4h-3A.5.5 0 0 1 2 14Z" />,
  businesses: <path d="M2.5 3.5h11v9h-11ZM5 6.5h6M5 9h4M8 12.5v2.5M6 15h4" />,
};

const PLATFORM_ADMIN_NAV = [
  { key: "overview" as const, href: "/admin/overview", label: "Overview" },
  { key: "businesses" as const, href: "/admin/businesses", label: "Businesses" },
];

function UserBlock({
  user,
  onSignOut,
  collapsed = false,
}: {
  user: AuthUser;
  onSignOut: () => void;
  collapsed?: boolean;
}) {
  const name = displayName(user);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const subtitle =
    user.role === "SUPERADMIN"
      ? roleLabel(user.role)
      : user.role === "SUBADMIN"
        ? `${roleLabel(user.role, user.title)} · ${user.businessName}`
        : `${roleLabel(user.role)} · ${user.businessName}`;

  if (collapsed)
    return (
      <div className="flex flex-col items-center gap-3 pt-4 mt-4 border-t border-neutral-200">
        <div className="w-8 h-8 rounded-full bg-[#171717] text-white flex items-center justify-center text-[10px] font-semibold tracking-wide shrink-0">
          {initials}
        </div>
        <button
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="text-neutral-400 hover:text-black transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.75v6.5M3.4 4.1a5.75 5.75 0 1 0 9.2 0" />
          </svg>
        </button>
      </div>
    );

  return (
    <div className="flex items-center gap-2.5 px-2 pt-4 mt-4 border-t border-neutral-200">
      <div className="w-8 h-8 rounded-full bg-[#171717] text-white flex items-center justify-center text-[10px] font-semibold tracking-wide shrink-0">
        {initials}
      </div>
      <div className="leading-tight min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#171717] truncate">{name}</p>
        <p className="text-[10px] text-[#171717]/65 truncate">{subtitle}</p>
      </div>
      <button
        onClick={onSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="shrink-0 text-[10px] uppercase tracking-[0.12em] font-medium text-neutral-400 hover:text-black transition-colors px-2 py-1.5 rounded-sm hover:bg-neutral-100"
      >
        Sign out
      </button>
    </div>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      animate={{ rotate: collapsed ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}

function BrandMark({
  brand,
  logoSrc,
  collapsed = false,
  className = "",
}: {
  brand: string;
  logoSrc: string | null;
  collapsed?: boolean;
  className?: string;
}) {
  if (!logoSrc) {
    return (
      <span
        className={`font-semibold tracking-tight text-[#171717] ${
          collapsed ? "text-sm" : "text-xl"
        } ${className}`}
      >
        {collapsed ? brand.slice(0, 1) : brand}
      </span>
    );
  }
  return (
    <img
      src={logoSrc}
      alt={brand}
      title={brand}
      className={
        className ||
        (collapsed
          ? "h-11 w-11 object-contain object-center mx-auto"
          : "h-20 w-20 object-contain object-left")
      }
    />
  );
}

function MobileNav({
  navLinks,
  user,
  onSignOut,
  brand,
  brandHref,
  logoSrc,
  children,
}: {
  navLinks: (onNavigate?: () => void) => ReactNode;
  user: AuthUser;
  onSignOut: () => void;
  brand: string;
  brandHref: string;
  logoSrc: string | null;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-3 bg-white/95 backdrop-blur border-b border-neutral-200 no-print">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="-ml-1 w-9 h-9 flex items-center justify-center rounded-sm text-neutral-700 hover:bg-neutral-100 active:scale-90 transition"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 5h15M2.5 10h15M2.5 15h15" />
          </svg>
        </button>
        <Link href={brandHref} title={brand} className="flex-1 min-w-0 flex justify-center px-2">
          <BrandMark brand={brand} logoSrc={logoSrc} className="h-14 w-14 object-contain object-center" />
        </Link>
        <span className="w-9" aria-hidden />
      </header>
      <main className="p-4">{children}</main>
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed top-0 left-0 bottom-0 z-50 w-[80vw] max-w-[300px] bg-white border-r border-neutral-200 overflow-y-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <div className="flex flex-col justify-between min-h-full py-6 px-4">
                <div>
                  <div className="flex items-center justify-between mb-8 min-h-20">
                    <BrandMark brand={brand} logoSrc={logoSrc} className="h-20 w-20 object-contain object-left" />
                    <button
                      onClick={() => setDrawerOpen(false)}
                      aria-label="Close menu"
                      className="w-8 h-8 flex items-center justify-center rounded-sm text-neutral-400 hover:text-black hover:bg-neutral-100"
                    >
                      ✕
                    </button>
                  </div>
                  {navLinks(() => setDrawerOpen(false))}
                </div>
                <UserBlock user={user} onSignOut={onSignOut} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, ready, logout } = useAuth();
  const { prefs } = useUiPreferences();
  const router = useRouter();

  const isPublic = pathname === "/" || pathname === "/login";
  const isAdminRoute = pathname === "/admin" || pathname?.startsWith("/admin/");
  const tenantPage = pagePathFromBusinessRoute(pathname ?? "") ?? "";
  const isPrintable =
    tenantPage.startsWith("/sales/") || tenantPage.startsWith("/invoices/");
  const roleHome = homeFor(user);

  useEffect(() => {
    if (!pathname || !ready || !user) return;

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
  }, [pathname, user, ready, isAdminRoute, roleHome, router]);

  if (!ready) {
    if (isPublic) return <>{children}</>;
    return <AuthBootstrapSkeleton />;
  }

  if (!user) {
    if (isPublic) return <>{children}</>;
    return null;
  }

  const onSignOut = () => {
    void logout().then(() => router.replace("/"));
  };

  const brand =
    user.role === "SUPERADMIN"
      ? "Tradex"
      : user.businessName?.trim() || user.name;
  const logoSrc =
    user.role === "SUPERADMIN"
      ? null
      : prefs.logoDataUrl.trim() || TRADEX_LOGO;

  const roleNav =
    user.role === "SUPERADMIN"
      ? PLATFORM_ADMIN_NAV
      : pagesFor(user);

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-0.5">
      {roleNav.map((n) => {
        const active = pathname === n.href || pathname?.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            title={n.label}
            onClick={onNavigate}
            className={`group relative flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-sm transition-colors duration-150 hover:bg-neutral-100 ${
              collapsed ? "md:justify-center md:px-2" : ""
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 bg-black"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative shrink-0 ${active ? "text-white" : "text-neutral-500 group-hover:text-black"}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[n.key]}
              </svg>
            </span>
            {!collapsed && (
              <motion.span
                initial={false}
                animate={{ opacity: 1 }}
                className={`relative whitespace-nowrap ${
                  active ? "text-white" : "text-neutral-700 group-hover:text-black"
                }`}
              >
                {n.label}
              </motion.span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  if (pathname === "/" || pathname === "/login") return null;
  if (isPrintable) return <>{children}</>;

  const pendingRedirect =
    (user.role === "SUPERADMIN" && !isAdminRoute) ||
    (user.role !== "SUPERADMIN" && isAdminRoute) ||
    !canOpenPath(user, pathname);

  const mainContent = pendingRedirect
    ? skeletonForPath(user.role === "SUPERADMIN" ? pathname ?? "/admin/overview" : roleHome)
    : children;

  return (
    <div className="min-h-screen">
      <div className="hidden md:flex">
        <motion.aside
          animate={{ width: collapsed ? 84 : 260 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className={`shrink-0 bg-white border-r border-neutral-200 flex flex-col justify-between py-6 sticky top-0 h-screen no-print ${
            collapsed ? "px-2" : "px-4"
          }`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div
              className={`mb-8 ${
                collapsed
                  ? "flex flex-col items-center gap-2.5"
                  : "flex items-start justify-between gap-2"
              }`}
            >
              <Link
                href={roleHome}
                title={brand}
                className={`leading-tight min-w-0 ${
                  collapsed ? "flex w-full justify-center" : "block flex-1"
                }`}
              >
                <BrandMark brand={brand} logoSrc={logoSrc} collapsed={collapsed} />
              </Link>
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`shrink-0 flex items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-600 hover:text-black hover:bg-neutral-100 hover:border-neutral-300 transition-colors duration-150 active:scale-95 ${
                  collapsed ? "w-9 h-9" : "w-8 h-8 mt-1"
                }`}
              >
                <Chevron collapsed={collapsed} />
              </button>
            </div>
            {navLinks()}
          </div>
          <div className="shrink-0">
            <UserBlock user={user} onSignOut={onSignOut} collapsed={collapsed} />
          </div>
        </motion.aside>
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{mainContent}</main>
      </div>

      <MobileNav
        key={pathname}
        navLinks={navLinks}
        user={user}
        onSignOut={onSignOut}
        brand={brand}
        brandHref={roleHome}
        logoSrc={logoSrc}
      >
        {mainContent}
      </MobileNav>
    </div>
  );
}
