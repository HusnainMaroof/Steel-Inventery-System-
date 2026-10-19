"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AppTopbarProps = {
  brand: string;
  logoSrc: string | null;
  /** Business panels show "Your logo" until a logo is uploaded; the platform panel shows its name. */
  logoPlaceholder: boolean;
  homeHref: string;
  userName: string;
  userSubtitle: string;
  onSignOut: () => void;
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

export default function AppTopbar({
  brand,
  logoSrc,
  logoPlaceholder,
  homeHref,
  userName,
  userSubtitle,
  onSignOut,
}: AppTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    signOutRef.current?.focus();

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function toggleMenu() {
    setMenuOpen((isOpen) => !isOpen);
  }

  function handleSignOut() {
    setMenuOpen(false);
    onSignOut();
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-[72px] items-center justify-between bg-[#F8F8F7] pr-4 sm:pr-6">
      <div className="flex w-[232px] shrink-0 items-center pl-4 pr-2">
        <Link
          href={homeHref}
          title={brand}
          aria-label={`${brand} home`}
          className="flex h-11 min-w-0 items-center rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={brand}
              width={180}
              height={44}
              unoptimized
              className="h-11 w-auto max-w-[180px] object-contain object-left"
            />
          ) : logoPlaceholder ? (
            <span className="inline-flex h-11 items-center rounded-2xl bg-white px-4 text-[13px] font-medium text-[#171717]/70">
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
          onClick={toggleMenu}
          className="flex min-h-11 max-w-[min(64vw,320px)] items-center gap-2.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-[#F8F8F7] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:gap-3 sm:px-3"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white"
          >
            {initialsFor(userName)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold text-[#171717]">
              {userName}
            </span>
            <span className="hidden max-w-[190px] truncate text-xs text-[#171717]/70 sm:block">
              {userSubtitle}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            size={16}
            strokeWidth={1.8}
            className={`shrink-0 text-[#171717]/70 transition-transform ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            aria-label="Account"
            className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-40 rounded-2xl border border-[#E5E5E5] bg-white p-1.5"
          >
            <button
              ref={signOutRef}
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-[#171717] hover:bg-[#F8F8F7] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
