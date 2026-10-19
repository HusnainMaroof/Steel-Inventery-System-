"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Activity,
  Boxes,
  Building2,
  ChartColumn,
  Circle,
  CircleHelp,
  CreditCard,
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
import { useId, useState } from "react";

export type SidebarItem = { key: string; href: string; label: string };

type AppSidebarProps = {
  items: SidebarItem[];
  pathname: string | null;
  onSignOut: () => void;
  helpHref: string;
};

type TooltipState = { label: string; top: number; id: string } | null;

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
  overview: LayoutGrid,
  businesses: Building2,
  subscriptions: CreditCard,
  system: Activity,
};

function RailControl({
  label,
  href,
  icon: Icon,
  active = false,
  onClick,
}: {
  label: string;
  href?: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const tooltipId = `rail-tooltip-${useId().replace(/:/g, "")}`;

  function showTooltip(element: HTMLAnchorElement | HTMLButtonElement) {
    const rect = element.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, id: tooltipId });
  }

  function hideTooltip(element: HTMLAnchorElement | HTMLButtonElement) {
    if (document.activeElement !== element) setTooltip(null);
  }

  const controlClassName = `group flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
    active
      ? "bg-ink text-white"
      : "text-[#171717]/60 hover:bg-white hover:text-[#171717]"
  }`;

  const control = href ? (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      aria-describedby={tooltip ? tooltip.id : undefined}
      className={controlClassName}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={(event) => hideTooltip(event.currentTarget)}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={() => setTooltip(null)}
    >
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
    </Link>
  ) : (
    <button
      type="button"
      aria-label={label}
      aria-describedby={tooltip ? tooltip.id : undefined}
      onClick={onClick}
      className={controlClassName}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={(event) => hideTooltip(event.currentTarget)}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={() => setTooltip(null)}
    >
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );

  return (
    <>
      {control}
      {tooltip && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tooltip.id}
              role="tooltip"
              className="pointer-events-none fixed left-[76px] z-[100] -translate-y-1/2 whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs font-medium text-white"
              style={{ top: tooltip.top }}
            >
              {tooltip.label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function isItemActive(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

export default function AppSidebar({
  items,
  pathname,
  onSignOut,
  helpHref,
}: AppSidebarProps) {
  return (
    <nav
      aria-label="Main"
      className="no-print sticky top-0 hidden h-screen w-[72px] shrink-0 flex-col items-center gap-3 border-r border-[#E5E5E5] bg-white py-4 md:flex"
    >
      <div className="flex min-h-0 flex-1 items-center">
        <div className="flex max-h-full flex-col gap-1 overflow-y-auto rounded-full bg-[#F1F1EF] p-1.5">
          {items.map((item) => {
            const Icon = ICONS[item.key] ?? Circle;
            return (
              <RailControl
                key={item.key}
                href={item.href}
                label={item.label}
                icon={Icon}
                active={isItemActive(pathname, item.href)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 rounded-full bg-[#F1F1EF] p-1.5">
        <RailControl href={helpHref} label="Help" icon={CircleHelp} />
        <RailControl label="Sign out" icon={LogOut} onClick={onSignOut} />
      </div>
    </nav>
  );
}
