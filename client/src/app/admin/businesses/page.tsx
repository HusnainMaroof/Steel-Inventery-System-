"use client";

import { useMemo, useState } from "react";
import { AddOwnerModal, BusinessListTable, planLabel, businessStatus, type BusinessStatus } from "@/components/admin/admin-ui";
import { AdminBusinessesSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { EmptyState, Page, PaginationBar } from "@/components/ui";
import { Search } from "lucide-react";

const PAGE_SIZE = 20;

type StatusFilter = "All" | BusinessStatus;

export default function AdminBusinessesPage() {
  const { user, ready } = useAuth();
  const { owners, templates, subscriptionPlans, loading, loadError, addOwner } =
    usePlatformAdminData(user?.role === "SUPERADMIN", {
      owners: true,
      templates: true,
      subscriptionPlans: true,
      overview: false,
    });
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return owners.filter((owner) => {
      if (q) {
        const hay = `${owner.business.name} ${owner.business.slug ?? ""} ${owner.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return status === "All" || businessStatus(owner) === status;
    });
  }, [owners, query, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || (loading && owners.length === 0)) return <AdminBusinessesSkeleton />;

  const clearFilters = () => {
    setQuery("");
    setStatus("All");
    setPage(1);
  };

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Businesses</h1>
          <p className="text-[#171717]/70 text-xs mt-1">
            All registered businesses — open a row to manage subscription, templates, and login.
          </p>
        </div>
        <button className="btn-primary w-full sm:w-auto shrink-0" onClick={() => setAddOpen(true)}>
          + Register business owner
        </button>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p>
      )}

      {!loading && owners.length === 0 && !loadError ? (
        <div className="panel">
          <EmptyState
            emoji="🏪"
            title="No businesses yet"
            hint="Register the first business owner and assign a subscription plan and product templates."
            action={<button className="btn-primary" onClick={() => setAddOpen(true)}>+ Register business owner</button>}
          />
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#171717]/40"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search business, link or email"
                aria-label="Search business, link or email"
                className="w-full rounded-md border border-[#E5E5E5] bg-white !pl-9 !pr-3 py-2 text-sm text-[#171717] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-xs text-[#171717]/70">
                Status
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusFilter);
                  setPage(1);
                }}
                className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
                <option value="Login off">Login off</option>
              </select>
            </div>
            <p className="ml-auto text-xs text-[#171717]/70 tabular-nums">
              {filtered.length} of {owners.length} businesses
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[#171717]/70 mb-3">No businesses match your filters.</p>
              <button type="button" className="btn-ghost" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <BusinessListTable
                owners={pageRows}
                planFor={(owner) => planLabel(owner.business)}
              />
              <PaginationBar
                page={safePage}
                pages={pages}
                total={filtered.length}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}

      <AddOwnerModal
        open={addOpen}
        templates={templates}
        subscriptionPlans={subscriptionPlans}
        onClose={() => setAddOpen(false)}
        onCreated={addOwner}
      />
    </Page>
  );
}