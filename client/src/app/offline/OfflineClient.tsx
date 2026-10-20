"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { TijarattBrand } from "@/components/marketing/PublicChrome";
import { probeAppHealth } from "@/lib/server-offline";

const OFFLINE_RETRY_INTERVAL_MS = 60_000;

export function OfflineClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/login";
  const [checking, setChecking] = useState(false);
  const autoTried = useRef(false);
  const inflightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** One probe at a time; a click or timer while one is running reuses it. */
  const retry = useCallback(() => {
    if (inflightRef.current) return inflightRef.current;
    setChecking(true);
    inflightRef.current = probeAppHealth()
      .then((ok) => {
        if (ok && mountedRef.current) {
          router.replace(next.startsWith("/offline") ? "/login" : next);
        }
      })
      .finally(() => {
        inflightRef.current = null;
        if (mountedRef.current) setChecking(false);
      });
    return inflightRef.current;
  }, [next, router]);

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    const timer = window.setTimeout(() => void retry(), 1200);
    return () => window.clearTimeout(timer);
  }, [retry]);

  // Slow fallback poll. The browser's online event triggers an immediate retry.
  useEffect(() => {
    const timer = window.setInterval(() => void retry(), OFFLINE_RETRY_INTERVAL_MS);
    window.addEventListener("online", retry);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", retry);
    };
  }, [retry]);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-primary/10 px-5 py-8 sm:px-6">
      <Link
        href="/"
        className="relative z-10 w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
        aria-label="Tijartt home"
      >
        <TijarattBrand />
      </Link>

      <div className="relative z-10 m-auto w-full max-w-[560px] py-12 text-center">
        <p className="font-mono text-[12px] font-medium tracking-[-0.03em] text-primary">
          CONNECTION STATUS / OFFLINE
        </p>
        <h1 className="mt-4 text-[clamp(42px,7vw,64px)] font-semibold leading-[1.03] tracking-[-0.037em] text-ink">
          The server is taking a moment.
        </h1>
        <p className="mx-auto mt-5 max-w-[480px] text-[15px] leading-[1.63] text-[#171717]/80">
          Tijartt cannot reach the business server right now. Your records
          are safe, and this page will retry automatically.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            disabled={checking}
            onClick={() => void retry()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary bg-[#FCFCFB] px-7 text-[14px] font-medium text-primary hover:bg-primary hover:text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={checking ? "animate-spin" : ""} size={15} />
            {checking ? "Checking…" : "Try again"}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#E5E5E5] bg-white/70 px-7 text-[14px] font-medium text-ink hover:border-primary hover:text-primary"
          >
            Back to home
          </Link>
        </div>
        <p className="mt-7 text-xs leading-[1.6] text-[#171717]/70">
          Running Tijartt locally? Start{" "}
          <code className="rounded-md border border-[#E5E5E5] bg-white/70 px-1.5 py-1 font-mono text-xs text-[#171717]/80">
            npm run start:dev
          </code>{" "}
          in the server folder.
        </p>
      </div>

      <p className="relative z-10 text-center font-mono text-xs text-[#171717]/70">
        AUTOMATIC RETRY RUNS EVERY 60 SECONDS
      </p>
    </main>
  );
}
