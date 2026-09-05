"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

/* minimal inline SVG icon set (stroke, 16px) */
const ICONS: Record<string, ReactNode> = {
  "/": <path d="M2 8.5 8 3l6 5.5V14a.5.5 0 0 1-.5.5h-3v-4h-3v4h-3A.5.5 0 0 1 2 14Z" />,
  "/purchases": <path d="M2 3h2l1.6 8.5a1 1 0 0 0 1 .8h5.9a1 1 0 0 0 1-.8L15 6H4.5M6.5 14.5h.01M11.5 14.5h.01" />,
  "/inventory": <path d="M3 5.5 8 3l5 2.5v5L8 13 3 10.5ZM3 5.5 8 8l5-2.5M8 8v5" />,
  "/products": <path d="M8 2 3 4.5v7L8 14l5-2.5v-7L8 2ZM3 4.5 8 7l5-2.5M8 7v7" />,
  "/sales": <path d="M3 2.5h10v11l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2ZM5.5 6h5M5.5 8.5h5" />,
  "/invoices": <path d="M4 2.5h8v11l-1.6-1-1.6 1-1.6-1-1.6 1-1.6-1ZM6 6h4M6 8.5h4" />,
  "/customers": <path d="M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 13.5c.7-2.2 3-3.5 5.5-3.5s4.8 1.3 5.5 3.5" />,
  "/suppliers": <path d="M2.5 13.5v-6l3-1.5v7.5M5.5 13.5h5v-9l-5 1.5M10.5 13.5h3v-4l-3-1.2M4 8.5h.01M7.5 9.5h.01" />,
  "/payments": <path d="M2 5.5h12v7H2ZM2 5.5 8 2.5l6 3M11.5 9h.01" />,
  "/profit": <path d="M2.5 13.5h11M4 12V8.5M7 12V5.5M10 12V7M13 12V3.5" />,
  "/reports": <path d="M4 2.5h6l2.5 2.5v8.5H4ZM10 2.5V5h2.5M6 8h4M6 10.5h4" />,
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/purchases", label: "Purchases" },
  { href: "/products", label: "Products" },
  { href: "/inventory", label: "Inventory" },
  { href: "/sales", label: "Sales" },
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
  { href: "/suppliers", label: "Mills / Suppliers" },
  { href: "/payments", label: "Payments" },
  { href: "/profit", label: "Profit & Loss" },
  { href: "/reports", label: "Reports" },
];

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
  children,
}: {
  navLinks: (onNavigate?: () => void) => ReactNode;
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
        <Link href="/" className="text-sm font-medium tracking-tight whitespace-nowrap">
          STEEL <span className="text-neutral-400">AND LEDGER</span>
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
                    <div className="text-lg font-medium tracking-tight whitespace-nowrap">
                      STEEL <span className="text-neutral-400">AND LEDGER</span>
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
                <div className="text-[11px] text-neutral-400 uppercase tracking-widest whitespace-nowrap pt-6">
                  Mock data · FY 2026
                </div>
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

  if (pathname?.startsWith("/invoices/")) return <>{children}</>;

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active =
          n.href === "/"
            ? pathname === "/"
            : pathname?.startsWith(n.href);
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
          className="shrink-0 border-r border-neutral-200 flex flex-col justify-between py-6 px-4 sticky top-0 h-screen no-print overflow-hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-10 min-h-8">
              <Link href="/" className="block leading-tight min-w-0">
                {collapsed ? (
                  <span className="text-lg font-medium tracking-tight">S/L</span>
                ) : (
                  <>
                    <div className="text-lg font-medium tracking-tight whitespace-nowrap">
                      STEEL <span className="text-neutral-400">AND LEDGER</span>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mt-1">
                      Steel Factory
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
          {!collapsed && (
            <div className="text-[11px] text-neutral-400 uppercase tracking-widest whitespace-nowrap">
              Mock data · FY 2026
            </div>
          )}
        </motion.aside>
        <main className="flex-1 min-w-0 p-6 lg:p-8">{children}</main>
      </div>

      {/* ===== Mobile layout (below md) ===== */}
      <MobileNav key={pathname} navLinks={navLinks}>
        {children}
      </MobileNav>
    </div>
  );
}
