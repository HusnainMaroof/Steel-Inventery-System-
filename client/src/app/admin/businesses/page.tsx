"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddOwnerModal, AdminPageHeader, BusinessListTable, planLabel, businessStatus, type BusinessStatus } from "@/components/admin/admin-ui";
import { AdminBusinessesSkeleton } from "@/components/skeletons";
import { usePlatformAdminData } from "@/hooks/use-platform-admin-data";
import { useAuth } from "@/lib/auth";
import { EmptyState, Page, PaginationBar } from "@/components/ui";

const PAGE_SIZE = 20;

type StatusFilter = "All" | BusinessStatus;

// useSearchParams needs a Suspense boundary, or the production build fails.
export default function AdminBusinessesPage() {
  return (
    <Suspense fallback={<AdminBusinessesSkeleton />}>
      <AdminBusinessesContent />
    </Suspense>
  );
}

function AdminBusinessesContent() {
  const router = useRouter();
  // "?new=1" (from the Overview "+ Register owner" link) opens the register modal.
  const openFromLink = useSearchParams().get("new") === "1";
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
      <AdminPageHeader
        title="Businesses"
        meta={`${filtered.length} of ${owners.length} businesses`}
        actions={
          <button className="btn-primary shrink-0" onClick={() => setAddOpen(true)}>
            Register owner
          </button>
        }
      />

      {loadError && (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p>
      )}

      {!loading && owners.length === 0 && !loadError ? (
        <EmptyState
          emoji=""
          title="No businesses yet"
          action={<button className="btn-primary" onClick={() => setAddOpen(true)}>Register owner</button>}
        />
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search business, link or email"
                aria-label="Search business, link or email"
                className="w-full"
              />
            </div>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="!w-auto min-w-44 shrink-0"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Login off">Login off</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              emoji=""
              title="No businesses match your filters"
              hint="Try a different search term or status."
              action={<button type="button" className="btn-ghost" onClick={clearFilters}>Clear search</button>}
            />
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
        open={addOpen || openFromLink}
        templates={templates}
        subscriptionPlans={subscriptionPlans}
        onClose={() => {
          setAddOpen(false);
          // replace, not push, so Back still returns to Overview
          if (openFromLink) router.replace("/admin/businesses");
        }}
        onCreated={addOwner}
      />
    </Page>
  );
}