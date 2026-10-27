"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#modules", label: "Modules" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#171717]";

export function Navbar() {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  const close = (returnFocus: boolean) => {
    setOpenOn(null);
    if (returnFocus) toggleRef.current?.focus();
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenOn(null);
        toggleRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenOn(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  /** Arrow keys move through the menu items; Tab past the last item closes it. */
  const onMenuKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("a") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Tab" && !event.shiftKey && index === items.length - 1) {
      close(false);
    }
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-20 h-[64px] w-full max-w-[100vw] border-b bg-canvas/95 font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#171717] backdrop-blur-sm transition-[border-color] duration-300 [font-feature-settings:'cv11','ss01'] ${
        scrolled || open ? "border-line" : "border-transparent"
      }`}
    >
      <div className="relative mx-auto flex h-[64px] w-full max-w-[1220px] items-center justify-between px-10 max-[1024px]:px-6 max-[640px]:px-4">
        <Link
          className={`inline-flex items-center rounded-md motion-safe:animate-rise motion-safe:delay-100 ${focus}`}
          href="/"
          aria-label="Tijartt home"
        >
          <Image
            src="/images/tijartt-logo.png"
            alt="Tijartt"
            width={800}
            height={328}
            priority
            sizes="(max-width: 640px) 80px, 88px"
            className="h-9 w-auto max-[640px]:h-8"
          />
        </Link>
        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-[30px] motion-safe:animate-fade motion-safe:delay-150 min-[1025px]:flex"
          aria-label="Main navigation"
        >
          {links.map((link) => {
            const current = pathname === link.href;
            return (
              <Link
                key={link.label}
                aria-current={current ? "page" : undefined}
                className={`relative inline-flex min-h-10 items-center text-sm font-medium no-underline after:absolute after:inset-x-0 after:bottom-1.5 after:h-0.5 after:origin-left after:rounded-full after:transition-transform after:duration-300 motion-reduce:after:transition-none ${
                  current
                    ? "text-primary after:scale-x-100 after:bg-primary"
                    : "text-[#171717] after:scale-x-0 after:bg-[#171717] hover:after:scale-x-100"
                } ${focus}`}
                href={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-[18px] motion-safe:animate-rise motion-safe:delay-150 max-[640px]:ml-auto max-[640px]:gap-2">
          <Link
            aria-current={pathname === "/login" ? "page" : undefined}
            className={`inline-flex min-h-10 items-center text-sm font-medium text-[#171717] no-underline hover:opacity-70 max-[640px]:hidden ${focus}`}
            href="/login"
          >
            Log in
          </Link>
          <Link
            className={`group inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-mint px-5 text-sm font-medium text-ink no-underline transition-[background-color,scale] duration-200 hover:bg-mint-hover active:scale-[0.98] motion-reduce:transition-none max-[640px]:hidden ${focus}`}
            href="/contact"
          >
            Get started
          </Link>
          <button
            className={`hidden size-10 items-center justify-center rounded-lg border border-[#171717] bg-white text-[#111] transition-[scale] duration-150 active:scale-95 motion-reduce:transition-none max-[1024px]:inline-flex ${focus}`}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close menu" : "Open menu"}
            ref={toggleRef}
            onClick={() => setOpenOn(open ? null : pathname)}
          >
            <span className="relative block h-3 w-[14px]" aria-hidden="true">
              <span
                className={`absolute left-0 h-[1.5px] w-full bg-[#111] transition-[top,rotate] duration-200 motion-reduce:transition-none ${open ? "top-[5px] rotate-45" : "top-0"}`}
              />
              <span
                className={`absolute top-[5px] left-0 h-[1.5px] w-full bg-[#111] transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute left-0 h-[1.5px] w-full bg-[#111] transition-[top,rotate] duration-200 motion-reduce:transition-none ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`}
              />
            </span>
          </button>
        </div>
        <nav
          ref={menuRef}
          id="mobile-navigation"
          aria-label="Mobile navigation"
          aria-hidden={!open}
          inert={!open}
          onKeyDown={onMenuKey}
          className={`absolute top-[58px] right-4 z-50 flex w-[260px] origin-top-right flex-col rounded-xl border border-line bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.08)] transition-[opacity,scale,translate,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:right-6 min-[1025px]:hidden ${
            open ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-1 scale-95 opacity-0"
          }`}
        >
          {[...links, { href: "/login", label: "Log in" }].map((link, index) => {
            const current = pathname === link.href;
            return (
              <Link
                key={link.label}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-medium no-underline transition-[background-color,translate,opacity] duration-300 hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none motion-reduce:transition-none ${
                  current ? "text-primary" : "text-[#171717]"
                } ${open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
                style={{ transitionDelay: open ? `${index * 25}ms` : "0ms" }}
                href={link.href}
                onClick={() => close(false)}
              >
                {link.label}
                {current ? <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
              </Link>
            );
          })}
          <Link
            className="mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-mint px-3 text-sm font-medium text-ink no-underline transition-[background-color,scale] duration-200 hover:bg-mint-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
            href="/contact"
            onClick={() => close(false)}
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
