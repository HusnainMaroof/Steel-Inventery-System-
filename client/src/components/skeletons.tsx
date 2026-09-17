"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* Shimmer block — the atomic building block for every skeleton state */
export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`skeleton-shimmer rounded-md bg-neutral-200/80 ${className}`}
    />
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="opacity-100 transition-opacity duration-300" aria-busy="true" aria-label="Loading page">
      {children}
    </div>
  );
}

/* Dashboard — hero card + due cards + KPI row */
export function DashboardSkeleton() {
  return (
    <PageShell>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-[220px] rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      <div className="mb-8">
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-10 w-full max-w-xs rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <Skeleton className="lg:col-span-12 xl:col-span-6 h-[220px] rounded-lg !bg-neutral-300/60" />
        <Skeleton className="lg:col-span-6 xl:col-span-3 h-[140px] rounded-lg" />
        <Skeleton className="lg:col-span-6 xl:col-span-3 h-[140px] rounded-lg" />
        <Skeleton className="lg:col-span-6 xl:col-span-3 h-[140px] rounded-lg !bg-neutral-300/60" />
        <Skeleton className="lg:col-span-6 xl:col-span-3 h-[140px] rounded-lg" />
      </div>

      <Skeleton className="h-3 w-72 mt-6" />
    </PageShell>
  );
}

/* Table pages — purchases, sales, customers, suppliers, payments, inventory */
export function TablePageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      <div className="panel bg-white overflow-hidden">
        <div className="border-b border-neutral-200 px-4 py-3 flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-neutral-100 last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1 max-w-[180px]" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/* Reports — tab bar + large content panels */
export function ReportsSkeleton() {
  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-56 rounded-lg lg:col-span-2" />
      </div>
    </PageShell>
  );
}

/* Products catalogue — sidebar list + detail panel */
export function CatalogueSkeleton() {
  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-[480px]">
        <div className="panel bg-white p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
        <div className="panel bg-white p-5 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/* Detail pages — purchase/sale/invoice view */
export function DetailPageSkeleton() {
  return (
    <PageShell>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Skeleton className="h-24 rounded-lg lg:col-span-2" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <div className="panel bg-white overflow-hidden">
        <div className="border-b border-neutral-200 px-4 py-3 flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-neutral-100 last:border-0"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/* Settings — form fields + preview card */
export function SettingsSkeleton() {
  return (
    <PageShell>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3.5 w-52" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-9 w-24 rounded-lg mt-2" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </PageShell>
  );
}

/* Auth bootstrap — sidebar visible, content loading */
export function AuthBootstrapSkeleton() {
  const pathname = usePathname() ?? "";
  return (
    <div className="min-h-screen flex" aria-busy="true" aria-label="Signing in">
      <aside className="hidden md:flex w-[248px] shrink-0 bg-white border-r border-neutral-200 flex-col p-4 gap-3">
        <Skeleton className="h-8 w-32 mb-6" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-sm" />
        ))}
      </aside>
      <main className="flex-1 p-6 lg:p-8">
        {skeletonForPath(pathname)}
      </main>
    </div>
  );
}

/* Platform admin — overview stats + activity panels */
export function AdminOverviewSkeleton() {
  return (
    <PageShell>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>
    </PageShell>
  );
}

/* Platform admin — businesses table */
export function AdminBusinessesSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="panel overflow-hidden">
        <div className="border-b border-neutral-100 bg-neutral-50/80 px-4 py-2.5 flex gap-8">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-48 hidden sm:block" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function AdminBusinessDetailSkeleton() {
  return (
    <PageShell>
      <Skeleton className="h-3 w-32 mb-4" />
      <div className="flex flex-wrap justify-between gap-3 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-lg" />
        ))}
      </div>
    </PageShell>
  );
}

export function AdminSubscriptionsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="panel overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-neutral-100 flex justify-between gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function AdminProductsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </PageShell>
  );
}

/** Pick the skeleton that best matches the current tenant route */
export function skeletonForPath(pathname: string) {
  if (pathname.startsWith("/admin/businesses/") && pathname !== "/admin/businesses") {
    return <AdminBusinessDetailSkeleton />;
  }
  if (pathname.startsWith("/admin/businesses")) return <AdminBusinessesSkeleton />;
  if (pathname.startsWith("/admin/products")) return <AdminProductsSkeleton />;
  if (pathname.startsWith("/admin/subscriptions")) return <AdminSubscriptionsSkeleton />;
  if (pathname.startsWith("/admin")) return <AdminOverviewSkeleton />;

  const page = pathname.replace(/^\/[^/]+/, "") || "/dashboard";

  if (page.startsWith("/dashboard")) return <DashboardSkeleton />;
  if (page.startsWith("/reports") || page.startsWith("/profit") || page.startsWith("/audit")) {
    return <ReportsSkeleton />;
  }
  if (page.startsWith("/products")) return <CatalogueSkeleton />;
  if (page.startsWith("/settings") || page.startsWith("/staff")) return <SettingsSkeleton />;
  if (
    page.startsWith("/purchases/") ||
    page.startsWith("/sales/") ||
    page.startsWith("/invoices/")
  ) {
    if (page === "/sales" || page === "/purchases" || page === "/invoices") {
      return <TablePageSkeleton />;
    }
    return <DetailPageSkeleton />;
  }
  return <TablePageSkeleton />;
}
