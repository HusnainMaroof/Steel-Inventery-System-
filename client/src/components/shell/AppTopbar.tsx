"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  CircleHelp,
  LogOut,
  Settings,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type AppTopbarProps = {
  brand: string;
  logoSrc: string | null;
  /** Business panels show "Your logo" until a logo is uploaded; the platform panel shows its name. */
  logoPlaceholder: boolean;
  homeHref: string;
  userName: string;
  userSubtitle: string;
  userEmail?: string;
  settingsHref?: string;
  staffHref?: string;
  onSignOut: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  dividerBefore?: boolean;
};

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

function firstNameFor(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name;
}

const itemBase =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2";

export default function AppTopbar({
  brand,
  logoSrc,
  logoPlaceholder,
  homeHref,
  userName,
  userSubtitle,
  userEmail,
  settingsHref,
  staffHref,
  onSignOut,
}: AppTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();
  const reduceMotion = useReducedMotion();

  const email = userEmail?.trim();

  function handleSignOut() {
    setMenuOpen(false);
    onSignOut();
  }

  const items: MenuItem[] = [];
  if (settingsHref) {
    items.push({ key: "settings", label: "Settings", icon: Settings, href: settingsHref });
  }
  if (staffHref) {
    items.push({ key: "staff", label: "Staff", icon: UserCog, href: staffHref });
  }
  items.push({
    key: "help",
    label: "Help",
    icon: CircleHelp,
    href: "mailto:contact@tijartt.com",
  });
  items.push({
    key: "signout",
    label: "Sign out",
    icon: LogOut,
    onSelect: handleSignOut,
    destructive: true,
    dividerBefore: true,
  });

  function focusableItems() {
    return itemRefs.current.filter((el): el is HTMLElement => el !== null);
  }

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === "Tab") {
        setMenuOpen(false);
        return;
      }

      const list = focusableItems();
      if (!list.length) return;

      const current = list.findIndex((el) => el === document.activeElement);
      let next = -1;

      if (event.key === "ArrowDown") {
        next = current < 0 ? 0 : (current + 1) % list.length;
      } else if (event.key === "ArrowUp") {
        next = current < 0 ? list.length - 1 : (current - 1 + list.length) % list.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = list.length - 1;
      }

      if (next < 0) return;
      event.preventDefault();
      list[next]?.focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    focusableItems()[0]?.focus();

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const motionDuration = reduceMotion ? 0 : 0.16;
  const slide = reduceMotion ? 0 : 4;

  return (
    <header className="no-print sticky top-0 z-30 hidden md:flex h-[72px] items-center justify-between bg-[#F8F8F7] pr-4 sm:pr-6">
      <div className="flex w-[232px] shrink-0 items-center pl-4 pr-2">
        <Link
          href={homeHref}
          title={brand}
          aria-label={`${brand} home`}
          className="flex h-14 min-w-0 items-center rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={brand}
              width={200}
              height={56}
              unoptimized
              className="h-14 w-auto max-w-[200px] object-contain object-left"
            />
          ) : logoPlaceholder ? (
            <span className="inline-flex h-14 items-center rounded-2xl bg-white px-5 text-sm font-medium text-[#171717]/70">
              Your logo
            </span>
          ) : (
            <span className="truncate pl-3.5 text-lg font-semibold tracking-tight text-[#171717]">
              {brand}
            </span>
          )}
        </Link>
      </div>

      <div ref={menuRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Account menu for ${userName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
          className="flex min-h-11 items-center gap-2.5 rounded-full border border-[#E5E5E5] bg-white py-1.5 pl-2 pr-3 text-left transition-colors hover:bg-[#F8F8F7] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white"
          >
            {initialsFor(userName)}
          </span>
          <span className="hidden max-w-[180px] truncate text-sm font-semibold text-[#171717] md:block">
            {firstNameFor(userName)}
          </span>
          <ChevronDown
            aria-hidden="true"
            size={16}
            strokeWidth={1.8}
            className={`shrink-0 text-[#171717]/70 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -slide }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -slide }}
              transition={{ duration: motionDuration, ease: "easeOut" }}
              className="absolute right-0 top-[calc(100%+8px)] z-30 w-72 rounded-2xl border border-[#E5E5E5] bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(17,17,17,0.18)]"
            >
              <div className="flex items-start gap-3 px-3 pb-3 pt-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white"
                >
                  {initialsFor(userName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold leading-snug text-[#171717]">
                    {userName}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-[#171717]/70">
                    {userSubtitle}
                  </p>
                  {email ? (
                    <p className="mt-0.5 break-all text-[12px] leading-snug text-[#171717]/70">
                      {email}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mx-1 mb-1 h-px bg-[#E5E5E5]" aria-hidden="true" />

              <div role="menu" id={menuId} aria-label="Account">
                {items.map((item, index) => {
                  const Icon = item.icon;
                  const className = `${itemBase} ${
                    item.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-[#171717] hover:bg-[#F8F8F7]"
                  }`;

                  return (
                    <Fragment key={item.key}>
                      {item.dividerBefore ? (
                        <div role="separator" className="my-1 h-px bg-[#E5E5E5]" />
                      ) : null}
                      {item.href ? (
                        <Link
                          href={item.href}
                          role="menuitem"
                          ref={(el) => {
                            itemRefs.current[index] = el;
                          }}
                          onClick={() => setMenuOpen(false)}
                          className={className}
                        >
                          <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          ref={(el) => {
                            itemRefs.current[index] = el;
                          }}
                          onClick={item.onSelect}
                          className={className}
                        >
                          <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
