"use client";

import Link from "next/link";
import type { PlatformOverview } from "@/app/actions/platform";
import { StatCard, StatusBadge, SubBadge, fmtDate } from "@/components/admin/admin-ui";
import { BillingCycleBadge } from "@/components/admin/subscription-plans-ui";

const QUICK_LINKS = [
  {
    href: "/admin/businesses",
    title: "Businesses",
    desc: "Register owners, subscriptions, templates, passwords.",
  },
  {
    href: "/admin/subscriptions",
    title: "Plans",
    desc: "Monthly, yearly, lifetime, and custom billing.",
  },
  {
    href: "/admin/products",
    title: "Catalog",
    desc: "Steel, cement, wire, and custom product templates.",
  },
  {
    href: "/admin/system",
    title: "System",
    desc: "API health and platform checks.",
  },
] as const;

function sortBusinesses(list: PlatformOverview["businesses"]) {
  return [...list].sort((a, b) => {
    if (a.subscriptionActive !== b.subscriptionActive) {
      return a.subscriptionActive ? 1 : -1;
    }
    const actA = a.activity30d.sales + a.activity30d.purchases;
    const actB = b.activity30d.sales + b.activity30d.purchases;
    return actB - actA || a.businessName.localeCompare(b.businessName);
  });
}

export function AdminOverviewDashboard({ overview }: { overview: PlatformOverview }) {
  const { totals, subscriptions, catalog, attention, businesses } = overview;
  const sorted = sortBusinesses(businesses);
  const needsAttention =
    attention.expiredSubscriptions > 0 ||
    attention.revokedOwners > 0 ||
    attention.expiringSoon > 0;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel p-4 hover:border-neutral-900 transition-colors group"
            >
              <p className="text-sm font-semibold text-neutral-900 group-hover:underline underline-offset-2">
                {item.title}
              </p>
              <p className="text-[11px] text-neutral-500 mt-1.5 leading-snug">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Platform snapshot
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Businesses" value={totals.businesses} />
          <StatCard label="Active owners" value={totals.activeOwners} />
          <StatCard label="Active subscriptions" value={subscriptions.active} />
          <StatCard
            label="Expired subscriptions"
            value={subscriptions.expired}
            hint={attention.expiringSoon > 0 ? `${attention.expiringSoon} expiring in 14 days` : undefined}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Ledger activity (30 days)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Sales" value={totals.sales30d} hint="All tenants" />
          <StatCard label="Purchases" value={totals.purchases30d} hint="All tenants" />
          <StatCard label="Payments" value={totals.payments30d} hint="All tenants" />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold">Subscription mix</h2>
            <Link href="/admin/subscriptions" className="text-xs font-medium text-neutral-600 hover:text-black">
              Manage plans →
            </Link>
          </div>
          {subscriptions.byPlan.length === 0 ? (
            <p className="text-sm text-neutral-500">No plans configured yet.</p>
          ) : (
            <ul className="space-y-3">
              {subscriptions.byPlan.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-[13px] font-medium text-neutral-900">{plan.label}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {plan.count} business{plan.count === 1 ? "" : "es"}
                    </p>
                  </div>
                  <BillingCycleBadge cycle={plan.billingCycle} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="xl:col-span-5 space-y-4">
          <div className="panel p-4">
            <h2 className="text-sm font-semibold mb-3">Catalog & plans</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-neutral-500 text-[11px] uppercase tracking-wider">Templates</dt>
                <dd className="font-semibold tabular-nums mt-0.5">{catalog.templates}</dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-[11px] uppercase tracking-wider">Active plans</dt>
                <dd className="font-semibold tabular-nums mt-0.5">
                  {catalog.activePlans}
                  <span className="text-neutral-400 font-normal text-xs"> / {catalog.totalPlans}</span>
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link href="/admin/products" className="btn-ghost !py-1.5 !px-3 text-xs">
                Catalog
              </Link>
              <Link href="/admin/subscriptions" className="btn-ghost !py-1.5 !px-3 text-xs">
                Plans
              </Link>
            </div>
          </div>

          <div className={`panel p-4 ${needsAttention ? "border-[#f0d2cc]" : ""}`}>
            <h2 className="text-sm font-semibold mb-3">Needs attention</h2>
            {!needsAttention ? (
              <p className="text-sm text-neutral-500">All subscriptions and owner logins look healthy.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {attention.expiredSubscriptions > 0 ? (
                  <li className="flex justify-between gap-2">
                    <span className="text-neutral-700">Expired subscriptions</span>
                    <span className="font-semibold tabular-nums text-[#a12b1f]">
                      {attention.expiredSubscriptions}
                    </span>
                  </li>
                ) : null}
                {attention.expiringSoon > 0 ? (
                  <li className="flex justify-between gap-2">
                    <span className="text-neutral-700">Expiring within 14 days</span>
                    <span className="font-semibold tabular-nums text-amber-800">{attention.expiringSoon}</span>
                  </li>
                ) : null}
                {attention.revokedOwners > 0 ? (
                  <li className="flex justify-between gap-2">
                    <span className="text-neutral-700">Revoked owner logins</span>
                    <span className="font-semibold tabular-nums">{attention.revokedOwners}</span>
                  </li>
                ) : null}
              </ul>
            )}
            <Link href="/admin/businesses" className="inline-block text-xs font-medium mt-4 hover:underline">
              Review businesses →
            </Link>
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-semibold">Businesses on the platform</h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Sorted by attention, then 30-day activity
            </p>
          </div>
          <Link href="/admin/businesses" className="btn-primary !py-2 !px-3 text-xs">
            + Register owner
          </Link>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-neutral-500 p-4">No businesses registered yet.</p>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-neutral-100">
              {sorted.map((row) => (
                <li key={row.ownerId} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{row.businessName}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{row.subscriptionPlanLabel}</p>
                    </div>
                    <StatusBadge active={row.ownerActive} />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <SubBadge active={row.subscriptionActive} status={row.subscriptionStatus} />
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-2 tabular-nums">
                    30d · {row.activity30d.sales} sales · {row.activity30d.purchases} purchases
                  </p>
                  {row.subscriptionEndsAt && !row.subscriptionActive ? (
                    <p className="text-[11px] text-[#a12b1f] mt-1">Ended {fmtDate(row.subscriptionEndsAt)}</p>
                  ) : row.subscriptionEndsAt ? (
                    <p className="text-[11px] text-neutral-400 mt-1">Renews {fmtDate(row.subscriptionEndsAt)}</p>
                  ) : null}
                  <Link
                    href={`/admin/businesses/${row.ownerId}`}
                    className="inline-block text-xs font-medium mt-3 hover:underline"
                  >
                    Manage →
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80">
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-neutral-500">
                      Business
                    </th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-neutral-500">
                      Plan
                    </th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-neutral-500">
                      Owner
                    </th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-neutral-500">
                      Subscription
                    </th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-neutral-500">
                      30-day activity
                    </th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-neutral-500 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sorted.map((row) => (
                    <tr key={row.ownerId}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{row.businessName}</td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">{row.subscriptionPlanLabel}</td>
                      <td className="px-4 py-3">
                        <StatusBadge active={row.ownerActive} />
                      </td>
                      <td className="px-4 py-3">
                        <SubBadge active={row.subscriptionActive} status={row.subscriptionStatus} />
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600 tabular-nums">
                        {row.activity30d.sales} sales · {row.activity30d.purchases} purchases ·{" "}
                        {row.activity30d.payments} payments
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/businesses/${row.ownerId}`}
                          className="btn-ghost !py-1.5 !px-3 text-xs"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
