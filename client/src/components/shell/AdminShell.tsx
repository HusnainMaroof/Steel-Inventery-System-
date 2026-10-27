"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AuthUser } from "@/lib/auth";
import { displayName } from "@/lib/auth-types";
import { useDrawerFocus } from "@/components/shell/useDrawerFocus";

export const PLATFORM_ADMIN_NAV = [
  { key: "overview", href: "/admin/overview", label: "Overview" },
  { key: "businesses", href: "/admin/businesses", label: "Businesses" },
  { key: "subscriptions", href: "/admin/subscriptions", label: "Plans" },
  { key: "products", href: "/admin/products", label: "Catalog" },
  { key: "system", href: "/admin/system", label: "System" },
] as const;

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function isActive(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Everything the Super Admin navigates with, in one column: brand, sections,
 * then the account with Help and Sign out. Replaces the old top bar and its
 * account dropdown, so nothing appears twice.
 */
function SidebarContent({
  user,
  pathname,
  onSignOut,
  onNavigate,
}: {
  user: AuthUser;
  pathname: string | null;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  const name = displayName(user);
  const email = user.email?.trim();

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-8">
        <Link href="/admin/overview" aria-label="Tijartt admin home" onClick={onNavigate} className={`inline-flex rounded-md ${focusRing}`}>
          <Image src="/images/tijartt-logo.png" alt="Tijartt" width={800} height={328} sizes="88px" priority className="h-8 w-auto" />
        </Link>
        <p className="mt-3">
          <span className="inline-flex rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-white">Super Admin</span>
        </p>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 text-[12px] font-semibold tracking-[0.02em] text-[#171717]/60">Platform</p>
        <ul className="flex flex-col gap-0.5">
          {PLATFORM_ADMIN_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-10 items-center rounded-lg px-3 text-[14px] transition-colors duration-150 ${focusRing} ${
                    active
                      ? "bg-[#F1F1EF] font-semibold text-ink before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
                      : "font-medium text-[#171717]/70 hover:bg-[#F6F6F4] hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-white">
            {initialsFor(name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink">{name}</span>
            {email ? <span className="block truncate text-[12px] text-[#171717]/70">{email}</span> : null}
          </span>
        </div>
        <a
          href="mailto:contact@tijartt.com"
          className={`flex min-h-10 items-center rounded-lg px-3 text-[14px] font-medium text-[#171717]/70 transition-colors hover:bg-[#F6F6F4] hover:text-ink ${focusRing}`}
        >
          Help
        </a>
        <button
          type="button"
          onClick={onSignOut}
          className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[14px] font-medium text-[#171717]/70 transition-colors hover:bg-destructive/10 hover:text-destructive ${focusRing}`}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Layout for every /admin page: fixed sidebar on desktop, a top bar with a drawer on phones. */
export function AdminShell({
  user,
  pathname,
  onSignOut,
  children,
}: {
  user: AuthUser;
  pathname: string | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useDrawerFocus(open, drawerRef, toggleRef);
  const reduceMotion = useReducedMotion();
  const current = PLATFORM_ADMIN_NAV.find((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <aside className="no-print sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-white md:block">
        <SidebarContent user={user} pathname={pathname} onSignOut={onSignOut} />
      </aside>

      <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur md:hidden">
        <Link href="/admin/overview" aria-label="Tijartt admin home" className={`inline-flex rounded-md ${focusRing}`}>
          <Image src="/images/tijartt-logo.png" alt="Tijartt" width={800} height={328} sizes="72px" className="h-7 w-auto" />
        </Link>
        <span className="text-[14px] font-semibold text-ink">{current?.label}</span>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls="admin-drawer"
          onClick={() => setOpen(true)}
          className={`min-h-10 rounded-full border border-line px-4 text-[14px] font-medium text-ink transition-[background-color,scale] hover:bg-canvas active:scale-[0.97] ${focusRing}`}
        >
          Menu
        </button>
      </header>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              ref={drawerRef}
              id="admin-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
              className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[300px] bg-white md:hidden"
              initial={{ x: reduceMotion ? 0 : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduceMotion ? 0 : "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`absolute top-6 right-4 min-h-10 rounded-full px-3 text-[14px] font-medium text-[#171717]/70 hover:text-ink ${focusRing}`}
              >
                Close
              </button>
              <SidebarContent user={user} pathname={pathname} onSignOut={onSignOut} onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
