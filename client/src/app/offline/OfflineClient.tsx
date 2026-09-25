"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { TijarattBrand } from "@/components/marketing/PublicChrome";
import { probeAppHealth } from "@/lib/server-offline";

export function OfflineClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/login";
  const [checking, setChecking] = useState(false);
  const autoTried = useRef(false);

  const retry = useCallback(async () => {
    setChecking(true);
    const ok = await probeAppHealth();
    setChecking(false);
    if (ok) {
      router.replace(next.startsWith("/offline") ? "/login" : next);
    }
  }, [next, router]);

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    const timer = window.setTimeout(() => void retry(), 1200);
    return () => window.clearTimeout(timer);
  }, [retry]);

  useEffect(() => {
    const timer = window.setInterval(() => void retry(), 30_000);
    return () => window.clearInterval(timer);
  }, [retry]);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f0f4fe] px-5 py-8 sm:px-6">
      <Link
        href="/"
        className="relative z-10 w-fit rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0099ff]"
        aria-label="Tijaratt home"
      >
        <TijarattBrand />
      </Link>

      <div className="relative z-10 m-auto w-full max-w-[560px] py-12 text-center">
        <p className="font-mono text-[12px] font-medium tracking-[-0.03em] text-[#145aff]">
          CONNECTION STATUS / OFFLINE
        </p>
        <h1 className="mt-4 text-[clamp(42px,7vw,64px)] font-semibold leading-[1.03] tracking-[-0.037em] text-[#020520]">
          The server is taking a moment.
        </h1>
        <p className="mx-auto mt-5 max-w-[480px] text-[15px] leading-[1.63] text-[#374151]">
          Tijaratt cannot reach the business server right now. Your records
          are safe, and this page will retry automatically.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            disabled={checking}
            onClick={() => void retry()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#145aff] bg-[#fcfcfc] px-7 text-[14px] font-medium text-[#145aff] hover:bg-[#145aff] hover:text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#0099ff] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={checking ? "animate-spin" : ""} size={15} />
            {checking ? "Checking…" : "Try again"}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#e2e8f0] bg-white/70 px-7 text-[14px] font-medium text-[#020520] hover:border-[#145aff] hover:text-[#145aff]"
          >
            Back to home
          </Link>
        </div>
        <p className="mt-7 text-[11px] leading-[1.6] text-[#6b7280]">
          Running Tijaratt locally? Start{" "}
          <code className="rounded-md border border-[#e2e8f0] bg-white/70 px-1.5 py-1 font-mono text-[10px] text-[#374151]">
            npm run start:dev
          </code>{" "}
          in the server folder.
        </p>
      </div>

      <p className="relative z-10 text-center font-mono text-[10px] text-[#6b7280]">
        AUTOMATIC RETRY RUNS EVERY 30 SECONDS
      </p>
    </main>
  );
}
