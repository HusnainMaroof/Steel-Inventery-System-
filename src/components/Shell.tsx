"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useAuth, type AuthUser } from "@/lib/auth";

/* minimal inline SVG icon set (stroke, 16px) */
const ICONS: Record<string, ReactNode> = {
  "/dashboard": <path d="M2 8.5 8 3l6 5.5V14a.5.5 0 0 1-.5.5h-3v-4h-3v4h-3A.5.5 0 0 1 2 14Z" />,
  "/purchases": <path d="M2 3h2l1.6 8.5a1 1 0 0 0 1 .8h5.9a1 1 0 0 0 1-.8L15 6H4.5M6.5 14.5h.01M11.5 14.5h.01" />,
  "/inventory": <path d="M3 5.5 8 3l5 2.5v5L8 13 3 10.5ZM3 5.5 8 8l5-2.5M8 8v5" />,
  "/products": <path d="M8 2 3 4.5v7L8 14l5-2.5v-7L8 2ZM3 4.5 8 7l5-2.5M8 7v7" />,
  "/sales": <path d="M3 2.5h10v11l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2ZM5.5 6h5M5.5 8.5h5" />,
  "/customers": <path d="M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 13.5c.7-2.2 3-3.5 5.5-3.5s4.8 1.3 5.5 3.5" />,
  "/suppliers": <path d="M2.5 13.5v-6l3-1.5v7.5M5.5 13.5h5v-9l-5 1.5M10.5 13.5h3v-4l-3-1.2M4 8.5h.01M7.5 9.5h.01" />,
  "/payments": <path d="M2 5.5h12v7H2ZM2 5.5 8 2.5l6 3M11.5 9h.01" />,
  "/reports": <path d="M4 2.5h6l2.5 2.5v8.5H4ZM10 2.5V5h2.5M6 8h4M6 10.5h4" />,
  "/admin": <path d="M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 13.5c.7-2.2 3-3.5 5.5-3.5s4.8 1.3 5.5 3.5M11.5 6.5h3M13 5v3" />,
};

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/purchases", label: "Purchases" },
  { href: "/products", label: "Products" },
  { href: "/inventory", label: "Inventory" },
  { href: "/sales", label: "Sales & Invoices" },
  { href: "/customers", label: "Customers" },
  { href: "/suppliers", label: "Mills / Suppliers" },
  { href: "/payments", label: "Payments" },
  { href: "/reports", label: "Reports & Profit" },
];

/* super admin sees only the owner-management panel */
const ADMIN_NAV = [{ href: "/admin", label: "Owners" }];

const roleLabel = (r: AuthUser["role"]) =>
  r === "superadmin" ? "Super Admin" : "Owner";

const initialsOf = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "TX";

/* signed-in identity + sign out — footer of the sidebar and the mobile drawer */
function UserBlock({
  user,
  onSignOut,
  collapsed = false,
}: {
  user: AuthUser;
  onSignOut: () => void;
  collapsed?: boolean;
}) {
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
        <p className="text-[13px] font-semibold text-[#171717] truncate">
          {user.name}
        </p>
        <p className="text-[10px] text-neutral-500">{roleLabel(user.role)}</p>
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

// Mobile header + drawer. Keyed by pathname in Shell so navigation resets its
// open state naturally (a fresh mount starts with the drawer closed).
function MobileNav({
  navLinks,
  user,
  onSignOut,
  brand,
  brandHref,
  children,
}: {
  navLinks: (onNavigate?: () => void) => ReactNode;
  user: AuthUser;
  onSignOut: () => void;
  brand: string;
  brandHref: string;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll while the drawer is open,
  // and auto-close the drawer if the viewport grows to tablet/desktop
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
      {/* top bar */}
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
        <Link
          href={brandHref}
          title={brand}
          className="flex-1 min-w-0 text-sm font-medium tracking-tight text-center truncate px-2"
        >
          {brand}
        </Link>
        <span className="w-9" aria-hidden />
      </header>

      <main className="p-4">{children}</main>
      {/* drawer + scrim */}
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
                  <div className="flex items-center justify-between mb-8 min-h-8">
                    <div
                      className="text-lg font-medium tracking-tight truncate max-w-[70%]"
                      title={brand}
                    >
                      {brand}
                    </div>
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
  const { user, logout } = useAuth();
  const router = useRouter();

  /* Public routes render without the sidebar. Everything else follows roles:
     logged-out visitors go to /login; a signed-in user on "/" or /login is
     taken to their role home; owners may not open /admin, and the super
     admin may not open the owner app (dashboard, depot screens, printable
     bills). */
  const isPublic = pathname === "/" || pathname === "/login";
  const isAdminRoute =
    pathname === "/admin" || pathname?.startsWith("/admin/");
  const isPrintable =
    pathname?.startsWith("/sales/") || pathname?.startsWith("/invoices/");
  const roleHome = user?.role === "superadmin" ? "/admin" : "/dashboard";

  useEffect(() => {
    if (!pathname) return;
    if (user) {
      if (pathname === "/" || pathname === "/login") router.replace(roleHome);
      else if (user.role === "owner" && isAdminRoute)
        router.replace("/dashboard");
      else if (user.role === "superadmin" && !isAdminRoute)
        router.replace("/admin");
    } else if (!isPublic) {
      router.replace("/login");
    }
  }, [pathname, user, isPublic, isAdminRoute, roleHome, router]);

  if (!user) {
    // public surfaces only — protected pages render nothing while redirecting
    if (isPublic) return <>{children}</>;
    return null;
  }
  if (pathname === "/" || pathname === "/login") return null; // heading home
  if (user.role === "owner" && isAdminRoute) return null; // heading to /dashboard
  if (user.role === "superadmin" && !isAdminRoute) return null; // heading to /admin
  // Printable invoice page (and old /invoices deep links) render without the
  // sidebar so the paper layout prints cleanly
  if (isPrintable) return <>{children}</>;

  const onSignOut = () => {
    logout();
    router.replace("/");
  };

  /* the signed-in owner's business name owns the brand spot; the super
     admin keeps the Tradex platform name */
  const brand =
    user.role === "superadmin"
      ? "Tradex"
      : user.businessName?.trim() || user.name;
  const brandCaption =
    user.role === "superadmin" ? "Owner management" : "Business Ledger";

  const roleNav = user.role === "superadmin" ? ADMIN_NAV : NAV;

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-0.5">
      {roleNav.map((n) => {
        const active =
          pathname === n.href || pathname?.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            title={n.label}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3 px-3 py-2.5 text-[15px] rounded-sm transition-colors duration-150 hover:bg-neutral-100 ${
              collapsed ? "md:justify-center" : ""
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 bg-black"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span
              className={`relative shrink-0 ${active ? "text-white" : "text-neutral-500 group-hover:text-black"}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[n.href]}
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

  return (
    <div className="min-h-screen">
      {/* ===== Desktop / tablet sidebar (md and up) ===== */}
      <div className="hidden md:flex">
        <motion.aside
          animate={{ width: collapsed ? 68 : 248 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="shrink-0 bg-white border-r border-neutral-200 flex flex-col justify-between py-6 px-4 sticky top-0 h-screen no-print overflow-hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-10 min-h-8">
              <Link href={roleHome} className="block leading-tight min-w-0">
                {collapsed ? (
                  <span
                    className="text-lg font-medium tracking-tight"
                    title={brand}
                  >
                    {initialsOf(brand)}
                  </span>
                ) : (
                  <>
                    <div
                      className="text-lg font-medium tracking-tight truncate"
                      title={brand}
                    >
                      {brand}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mt-1">
                      {brandCaption}
                    </div>
                  </>
                )}
              </Link>
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand" : "Collapse"}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-sm text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors duration-150 active:scale-90"
              >
                <Chevron collapsed={collapsed} />
              </button>
            </div>
            {navLinks()}
          </div>
          <UserBlock user={user} onSignOut={onSignOut} collapsed={collapsed} />
        </motion.aside>
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* ===== Mobile layout (below md) ===== */}
      <MobileNav
        key={pathname}
        navLinks={navLinks}
        user={user}
        onSignOut={onSignOut}
        brand={brand}
        brandHref={roleHome}
      >
        {children}
      </MobileNav>
    </div>
  );
}
