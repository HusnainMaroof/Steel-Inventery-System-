"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Boxes,
  ChartColumn,
  Circle,
  CircleHelp,
  Factory,
  LayoutGrid,
  LogOut,
  Package,
  Receipt,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type TenantNavItem = { key: string; href: string; label: string };

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutGrid,
  products: Package,
  purchases: ShoppingCart,
  inventory: Boxes,
  sales: ReceiptText,
  customers: Users,
  suppliers: Factory,
  payments: Wallet,
  expenses: Receipt,
  reports: ChartColumn,
  staff: UserCog,
  settings: Settings,
  audit: ShieldCheck,
  system: Activity,
};

/** Pages that manage the business rather than record the day; a hairline sits above the first one. */
const MANAGE_KEYS = new Set(["reports", "staff", "settings", "audit"]);

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

type Props = {
  items: TenantNavItem[];
  pathname: string | null;
  brand: string;
  brandHref: string;
  logoSrc: string | null;
  userName: string;
  userSubtitle: string;
  helpHref: string;
  onSignOut: () => void;
  onNavigate?: () => void;
  /** Distinguishes the desktop and drawer copies so the active pill animates within each. */
  layoutGroup: string;
};

/** The whole owner and staff navigation: brand, pages, then the account with Help and Sign out. */
export function TenantSidebarContent({
  items,
  pathname,
  brand,
  brandHref,
  logoSrc,
  userName,
  userSubtitle,
  helpHref,
  onSignOut,
  onNavigate,
  layoutGroup,
}: Props) {
  const reduceMotion = useReducedMotion();
  const firstManage = items.findIndex((item) => MANAGE_KEYS.has(item.key));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-5">
        <Link
          href={brandHref}
          onClick={onNavigate}
          aria-label={`${brand} home`}
          className={`flex min-h-12 items-center rounded-xl ${focusRing}`}
        >
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={brand}
              width={200}
              height={56}
              unoptimized
              className="h-11 w-auto max-w-[170px] object-contain object-left"
            />
          ) : (
            <span className="flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-[#171717]/20 text-[13px] font-medium text-[#171717]/60 transition-colors hover:border-[#171717]/40 hover:text-[#171717]">
              Your logo
            </span>
          )}
        </Link>
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <ul className="flex flex-col gap-0.5">
          {items.map((item, index) => {
            const Icon = ICONS[item.key] ?? Circle;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.key}>
                {index === firstManage && index > 0 ? <div role="separator" className="mx-3 my-2.5 h-px bg-line" /> : null}
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors duration-150 ${focusRing} ${
                    active ? "font-semibold text-white" : "font-medium text-[#171717]/70 hover:bg-[#F4F4F2] hover:text-ink"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId={`${layoutGroup}-active`}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xl bg-primary shadow-[0_8px_18px_-10px_rgba(46,107,46,0.9)]"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                    />
                  ) : null}
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className={`relative shrink-0 transition-colors ${active ? "text-white" : "text-[#171717]/55 group-hover:text-ink"}`}
                  />
                  <span className="relative truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-white">
            {initialsFor(userName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink">{userName}</span>
            <span className="block truncate text-[12px] text-[#171717]/70">{userSubtitle}</span>
          </span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <a
            href={helpHref}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-[#171717]/75 transition-colors hover:bg-[#F4F4F2] hover:text-ink ${focusRing}`}
          >
            <CircleHelp size={16} strokeWidth={1.8} aria-hidden="true" />
            Help
          </a>
          <button
            type="button"
            onClick={onSignOut}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-[#171717]/75 transition-colors hover:bg-destructive/10 hover:text-destructive ${focusRing}`}
          >
            <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Desktop sidebar: a floating panel that stays in view while the page scrolls. */
export function TenantSidebar(props: Omit<Props, "layoutGroup" | "onNavigate">) {
  return (
    <aside className="no-print sticky top-0 hidden h-dvh shrink-0 p-3 md:block">
      <div className="h-full w-[244px] overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04),0_12px_32px_-18px_rgba(17,17,17,0.16)]">
        <TenantSidebarContent {...props} layoutGroup="desktop" />
      </div>
    </aside>
  );
}
