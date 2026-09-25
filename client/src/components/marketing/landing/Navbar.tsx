"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#hero", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#site-footer", label: "Resources" },
] as const;

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#171717]";

export function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-10 h-[64px] w-full max-w-[100vw] bg-[#F8F8F7] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#171717] [font-feature-settings:'cv11','ss01']">
      <div className="relative mx-auto flex h-[64px] w-full max-w-[1220px] items-center justify-between px-10 max-[1024px]:px-6 max-[640px]:px-4">
        <Link
          className={`text-[20px] font-extrabold tracking-[-0.04em] text-[#111] no-underline motion-safe:animate-rise motion-safe:delay-100 max-[640px]:text-[18px] ${focus}`}
          href="/"
          aria-label="Tijaratt home"
        >
          Tijaratt
        </Link>
        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-[34px] motion-safe:animate-fade motion-safe:delay-150 min-[1025px]:flex"
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <Link
              key={link.label}
              className={`text-[13px] font-medium text-[#171717] no-underline hover:opacity-70 ${focus}`}
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-[18px] motion-safe:animate-rise motion-safe:delay-150 max-[640px]:ml-auto max-[640px]:gap-2">
          <Link
            className={`text-[13px] font-medium text-[#171717] no-underline hover:opacity-70 max-[640px]:hidden ${focus}`}
            href="/login"
          >
            Log in
          </Link>
          <Link
            className={`group inline-flex h-[38px] min-w-[124px] items-center justify-center gap-1.5 rounded-[7px] bg-[#111] px-3.5 text-[13px] font-medium text-white no-underline transition-colors duration-200 hover:bg-[#222] max-[640px]:hidden ${focus}`}
            href="/pricing"
          >
            <span>Get Started</span>
            <ArrowRight aria-hidden="true" size={14} className="transition-transform duration-200 group-hover:translate-x-[3px]" />
          </Link>
          <button
            className={`hidden size-[38px] items-center justify-center rounded-[7px] border border-[#171717] bg-white text-[#111] max-[1024px]:inline-flex ${focus}`}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="flex w-[14px] flex-col gap-1" aria-hidden="true">
              <span className="h-[1.5px] w-full bg-[#111]" />
              <span className="h-[1.5px] w-full bg-[#111]" />
              <span className="h-[1.5px] w-full bg-[#111]" />
            </span>
          </button>
        </div>
        {open ? (
          <nav
            id="mobile-navigation"
            className="absolute top-[58px] right-0 z-50 flex w-[220px] flex-col rounded-[8px] border border-[#E5E5E5] bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
            aria-label="Mobile navigation"
          >
            {links.map((link) => (
              <Link
                key={link.label}
                className="flex min-h-11 items-center rounded-[6px] px-3 text-[14px] font-medium text-[#171717] no-underline hover:bg-[#F8F8F7]"
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              className="flex min-h-11 items-center rounded-[6px] px-3 text-[14px] font-medium text-[#171717] no-underline hover:bg-[#F8F8F7]"
              href="/login"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              className="flex min-h-11 items-center rounded-[6px] px-3 text-[14px] font-medium text-[#171717] no-underline hover:bg-[#F8F8F7]"
              href="/pricing"
              onClick={() => setOpen(false)}
            >
              Get Started
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
