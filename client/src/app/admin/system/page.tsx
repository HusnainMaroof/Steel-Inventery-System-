"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminOverviewSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { probeAppHealth } from "@/lib/server-offline";
import { STATUS_CHECK_MIN_INTERVAL_MS } from "@/lib/server-status-monitor";
import { Page } from "@/components/ui";

export default function AdminSystemPage() {
  const { user, ready } = useAuth();
  const isSuperAdmin = ready && user?.role === "SUPERADMIN";
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const lastStartedAt = useRef(Number.NEGATIVE_INFINITY);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Shares one in-flight probe. Automatic triggers are throttled. Manual refresh is not.
  const runCheck = useCallback((manual: boolean) => {
    if (inflight.current) return inflight.current;
    if (!manual && Date.now() - lastStartedAt.current < STATUS_CHECK_MIN_INTERVAL_MS) {
      return Promise.resolve();
    }
    lastStartedAt.current = Date.now();
    setChecking(true);
    const promise = probeAppHealth()
      .then((ok) => {
        if (!mounted.current) return;
        setApiOk(ok);
        setCheckedAt(new Date().toLocaleTimeString());
      })
      .finally(() => {
        inflight.current = null;
        if (mounted.current) setChecking(false);
      });
    inflight.current = promise;
    return promise;
  }, []);

  // No timer. Check on load, then only when the tab regains focus or becomes visible.
  useEffect(() => {
    if (!isSuperAdmin) return;
    const onFocus = () => void runCheck(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void runCheck(false);
    };
    void runCheck(false);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isSuperAdmin, runCheck]);

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready) return <AdminOverviewSkeleton />;

  return (
    <Page>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">System</h1>
        <p className="text-[#171717]/70 text-xs mt-1 max-w-xl">
          Quick checks for the app and API. Use this when owners report login or sync issues.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="panel p-5">
          <p className="text-xs font-medium text-[#171717]/60">App health</p>
          <p className="text-2xl font-semibold mt-2">
            {apiOk === null ? "Checking…" : apiOk ? "Online" : "Unreachable"}
          </p>
          <p className="text-xs text-[#171717]/70 mt-2">
            Probes <code className="text-xs bg-[#F8F8F7] px-1 rounded">/api/health</code>
            {checkedAt ? ` · last check ${checkedAt}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void runCheck(true)}
            disabled={checking}
            className="btn-ghost min-h-11 mt-4"
          >
            {checking ? "Checking…" : "Check again"}
          </button>
          {apiOk === false ? (
            <p className="text-sm text-[#a12b1f] mt-3">
              Start the Nest API and ensure the Next proxy can reach it (see server README).
            </p>
          ) : null}
        </div>

        <div className="panel p-5">
          <p className="text-xs font-medium text-[#171717]/60">Your role</p>
          <p className="text-lg font-semibold mt-2">Super Admin</p>
          <p className="text-xs text-[#171717]/70 mt-2 leading-relaxed">
            You manage businesses, subscription plans, and catalogue templates. You do not operate tenant
            ledgers from this panel. Owners and staff use their business URLs.
          </p>
        </div>
      </div>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold mb-3">Platform checklist</h2>
        <ul className="text-sm text-[#171717]/70 space-y-2 list-disc pl-5">
          <li>
            <Link href="/admin/businesses" className="font-medium hover:underline">
              Businesses
            </Link>
            : register owners, reset passwords, assign templates.
          </li>
          <li>
            <Link href="/admin/subscriptions" className="font-medium hover:underline">
              Plans
            </Link>
            : control billing type and which sidebar modules each plan includes.
          </li>
          <li>
            <Link href="/admin/products" className="font-medium hover:underline">
              Catalog
            </Link>
            : edit trade templates before assigning them to new shops.
          </li>
          <li>
            <Link href="/admin/overview" className="font-medium hover:underline">
              Overview
            </Link>
            : subscription mix, expiring access, and per-business activity.
          </li>
        </ul>
      </section>
    </Page>
  );
}
