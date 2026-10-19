"use client";

import Link from "next/link";
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

export type SidebarItem = { key: string; href: string; label: string };

type AppSidebarProps = {
  items: SidebarItem[];
  pathname: string | null;
  onSignOut: () => void;
  helpHref: string;
};

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

const itemBase =
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function isItemActive(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/** Desktop navigation under the top bar: icon + label pills, help and sign out at the bottom. */
export default function AppSidebar({ items, pathname, onSignOut, helpHref }: AppSidebarProps) {
  return (
    <nav
      aria-label="Main"
      className="no-print sticky top-[72px] hidden h-[calc(100dvh-72px)] w-fit shrink-0 flex-col gap-4 pb-5 pl-4 pr-2 md:flex"
    >
      <div className="flex min-h-0 flex-1 items-center">
        <ul className="flex max-h-full w-fit min-w-[168px] flex-col gap-0.5 overflow-y-auto rounded-lg bg-white p-1.5">
          {items.map((item) => {
            const Icon = ICONS[item.key] ?? Circle;
            const active = isItemActive(pathname, item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemBase} ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-[#171717]/75 hover:bg-[#F1F1EF] hover:text-[#171717]"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                  <span className="whitespace-nowrap pr-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex w-fit min-w-[168px] shrink-0 flex-col gap-0.5 rounded-lg bg-white p-1.5">
        <Link
          href={helpHref}
          className={`${itemBase} text-[#171717]/75 hover:bg-[#F1F1EF] hover:text-[#171717]`}
        >
          <CircleHelp size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
          Help
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className={`${itemBase} text-[#171717]/75 hover:bg-destructive/10 hover:text-destructive`}
        >
          <LogOut size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
