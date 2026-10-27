"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "tijartt-cookie-notice";

/**
 * Cookie notice for the public pages. Tijartt only sets the cookie that keeps
 * a user signed in (no ads, no analytics), so there is nothing to opt in to:
 * the notice informs once and is dismissed with OK.
 */
export function CookieNotice() {
  const [state, setState] = useState<"hidden" | "shown" | "leaving">("hidden");

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === "ok";
    } catch {
      seen = false;
    }
    if (seen) return;
    const timer = window.setTimeout(() => setState("shown"), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "ok");
    } catch {
      // Private mode: the notice simply shows again next visit.
    }
    setState("leaving");
    window.setTimeout(() => setState("hidden"), 300);
  };

  if (state === "hidden") return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className={`fixed right-4 bottom-4 left-4 z-50 max-w-[380px] rounded-2xl border border-line bg-white p-5 text-[#171717] shadow-[0_18px_50px_-20px_rgba(17,17,17,0.35)] transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:animate-rise motion-reduce:transition-none sm:right-auto sm:bottom-6 sm:left-6 ${
        state === "leaving" ? "translate-y-3 opacity-0" : ""
      }`}
    >
      <p className="text-[16px] font-semibold tracking-[-0.01em]">Only the cookie you need</p>
      <p className="mt-2 text-[14px] leading-[1.55] text-[#171717]/70">
        We use one cookie to keep you signed in. No ads and no tracking.
      </p>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-6 text-[14px] font-medium text-white transition-[background-color,scale] duration-200 hover:bg-[#2a2a2a] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          OK
        </button>
        <Link
          href="/privacy-policy"
          className="inline-flex min-h-11 items-center text-[14px] font-medium text-[#171717] underline decoration-[#171717]/30 underline-offset-4 hover:decoration-[#171717]"
        >
          Privacy policy
        </Link>
      </div>
    </div>
  );
}
