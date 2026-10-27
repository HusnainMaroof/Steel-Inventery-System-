"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminOverviewSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { probeAppHealth } from "@/lib/server-offline";
import { STATUS_CHECK_MIN_INTERVAL_MS } from "@/lib/server-status-monitor";
import { Page } from "@/components/ui";
import { AdminPageHeader, AdminCard } from "@/components/admin/admin-ui";

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
      <AdminPageHeader title="System" meta="App and API checks." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <AdminCard title="App health">
          <p className="text-[14px] text-[#171717]/70 mb-1">
            Probes <code className="text-[13px] bg-[#F8F8F7] px-1 rounded">/api/health</code>
            {checkedAt ? ` · last check ${checkedAt}` : ""}
          </p>
          <p className="text-[28px] font-bold text-ink mt-2 mb-3">
            {apiOk === null ? "Checking…" : apiOk ? "Online" : "Unreachable"}
          </p>
          <button
            type="button"
            onClick={() => void runCheck(true)}
            disabled={checking}
            className="btn-ghost min-h-11"
          >
            {checking ? "Checking…" : "Check again"}
          </button>
          {apiOk === false ? (
            <p className="text-sm text-[#a12b1f] mt-3">
              Start the Nest API and ensure the Next proxy can reach it (see server README).
            </p>
          ) : null}
        </AdminCard>

        <AdminCard title="Your role">
          <p className="text-[22px] font-bold text-ink mt-2 mb-2">Super Admin</p>
          <p className="text-[14px] text-[#171717]/70 leading-relaxed">
            You manage businesses, subscription plans, and catalogue templates. You do not operate tenant
            ledgers from this panel. Owners and staff use their business URLs.
          </p>
        </AdminCard>
      </div>

    </Page>
  );
}
