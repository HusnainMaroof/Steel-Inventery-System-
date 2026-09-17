"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BusyButton } from "@/components/ui";
import { probeAppHealth } from "@/lib/server-offline";

const ease = [0.22, 1, 0.36, 1] as const;

export function OfflineClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/login";
  const [checking, setChecking] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  const retry = useCallback(async () => {
    setChecking(true);
    const ok = await probeAppHealth();
    setChecking(false);
    if (ok) {
      router.replace(next.startsWith("/offline") ? "/login" : next);
    }
  }, [next, router]);

  useEffect(() => {
    if (autoTried) return;
    setAutoTried(true);
    const timer = window.setTimeout(() => void retry(), 1200);
    return () => window.clearTimeout(timer);
  }, [autoTried, retry]);

  useEffect(() => {
    const timer = window.setInterval(() => void retry(), 30_000);
    return () => window.clearInterval(timer);
  }, [retry]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f8f7] px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease }}
          className="mb-8"
        >
          <div className="text-xl font-semibold tracking-tight">Tradex</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#171717]/70 mt-1.5">
            Business Ledger
          </div>
        </motion.div>

        <motion.div
          className="panel bg-white p-7 sm:p-9"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease }}
        >
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#fafafa]"
            aria-hidden
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-500"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>

          <h1 className="text-[20px] font-semibold tracking-tight">Server not responding</h1>
          <p className="text-[13px] leading-relaxed text-[#171717]/70 mt-3 mb-7">
            Tradex cannot reach the business server right now. Your data is safe — the app will
            reconnect automatically when the server is back online.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <BusyButton
              type="button"
              loading={checking}
              className="w-full sm:w-auto !py-3 !px-6"
              onClick={() => void retry()}
            >
              Try again
            </BusyButton>
            <Link href="/" className="btn-ghost w-full sm:w-auto !py-3 text-center">
              Back to homepage
            </Link>
          </div>

          <p className="text-[11px] text-neutral-400 mt-6">
            If you run Tradex locally, start the server with{" "}
            <code className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded">
              npm run start:dev
            </code>{" "}
            in the <span className="font-mono">server</span> folder.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
