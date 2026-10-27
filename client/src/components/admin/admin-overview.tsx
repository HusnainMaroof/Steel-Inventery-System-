"use client";

import Link from "next/link";
import type { PlatformOverview } from "@/app/actions/platform";
import {
  AdminCard,
  AdminSectionTitle,
  BusinessStatusBadge,
  StatGroup,
  fmtDate,
} from "@/components/admin/admin-ui";
import { BillingCycleBadge } from "@/components/admin/subscription-plans-ui";

const textLink =
  "text-[13px] font-semibold text-ink underline decoration-[#171717]/25 underline-offset-4 transition-colors hover:decoration-[#171717]";

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
    <div className="space-y-10">
      <section>
        <AdminSectionTitle title="Platform" />
        <StatGroup
          stats={[
            { label: "Businesses", value: totals.businesses, href: "/admin/businesses" },
            { label: "Active owners", value: totals.activeOwners },
            { label: "Active subscriptions", value: subscriptions.active, tone: "good" },
            {
              label: "Expired subscriptions",
              value: subscriptions.expired,
              tone: subscriptions.expired > 0 ? "alert" : "default",
              hint: attention.expiringSoon > 0 ? `${attention.expiringSoon} expiring in 14 days` : undefined,
            },
          ]}
        />
      </section>

      <section>
        <AdminSectionTitle title="Ledger activity, 30 days" />
        <StatGroup
          columns={3}
          stats={[
            { label: "Sales", value: totals.sales30d },
            { label: "Purchases", value: totals.purchases30d },
            { label: "Payments", value: totals.payments30d },
          ]}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <AdminCard
          className="xl:col-span-7"
          title="Subscription mix"
          action={
            <Link href="/admin/subscriptions" className={textLink}>
              Manage plans
            </Link>
          }
        >
          {subscriptions.byPlan.length === 0 ? (
            <p className="text-[14px] text-[#171717]/70">No plans yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {subscriptions.byPlan.map((plan) => (
                <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{plan.label}</p>
                    <p className="mt-0.5 text-[13px] text-[#171717]/70 tabular-nums">
                      {plan.count} business{plan.count === 1 ? "" : "es"}
                    </p>
                  </div>
                  <BillingCycleBadge cycle={plan.billingCycle} />
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <div className="space-y-6 xl:col-span-5">
          <AdminCard
            title="Needs attention"
            className={needsAttention ? "border-destructive/30" : ""}
            action={
              <Link href="/admin/businesses" className={textLink}>
                Review
              </Link>
            }
          >
            {!needsAttention ? (
              <p className="text-[14px] text-[#171717]/70">All subscriptions and owner logins look healthy.</p>
            ) : (
              <ul className="divide-y divide-line text-[14px]">
                {attention.expiredSubscriptions > 0 ? (
                  <li className="flex justify-between gap-2 py-2.5 first:pt-0">
                    <span className="text-ink">Expired subscriptions</span>
                    <span className="font-bold tabular-nums text-destructive">{attention.expiredSubscriptions}</span>
                  </li>
                ) : null}
                {attention.expiringSoon > 0 ? (
                  <li className="flex justify-between gap-2 py-2.5 first:pt-0">
                    <span className="text-ink">Expiring within 14 days</span>
                    <span className="font-bold tabular-nums text-warning">{attention.expiringSoon}</span>
                  </li>
                ) : null}
                {attention.revokedOwners > 0 ? (
                  <li className="flex justify-between gap-2 py-2.5 first:pt-0">
                    <span className="text-ink">Revoked owner logins</span>
                    <span className="font-bold tabular-nums">{attention.revokedOwners}</span>
                  </li>
                ) : null}
              </ul>
            )}
          </AdminCard>

          <StatGroup
            columns={2}
            stats={[
              { label: "Templates", value: catalog.templates, href: "/admin/products" },
              {
                label: "Active plans",
                value: catalog.activePlans,
                hint: `of ${catalog.totalPlans} plans`,
                href: "/admin/subscriptions",
              },
            ]}
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Businesses</h2>
            <p className="mt-0.5 text-[13px] text-[#171717]/70">Needs attention first, then most active</p>
          </div>
          <Link href="/admin/businesses?new=1" className="btn-primary">
            Register owner
          </Link>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-[#171717]/70 p-4">No businesses registered yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-line lg:hidden">
              {sorted.map((row) => (
                <li key={row.ownerId} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-ink">{row.businessName}</p>
                      <p className="text-[13px] text-[#171717]/70 mt-0.5">{row.subscriptionPlanLabel}</p>
                    </div>
                    <BusinessStatusBadge
                      ownerActive={row.ownerActive}
                      subscriptionActive={row.subscriptionActive}
                      subscriptionStatus={row.subscriptionStatus}
                    />
                  </div>
                  <p className="text-[13px] text-[#171717]/70 mt-2 tabular-nums">
                    30d · {row.activity30d.sales} sales · {row.activity30d.purchases} purchases
                  </p>
                  {row.subscriptionEndsAt && !row.subscriptionActive ? (
                    <p className="text-[13px] text-destructive mt-1">Ended {fmtDate(row.subscriptionEndsAt)}</p>
                  ) : row.subscriptionEndsAt ? (
                    <p className="text-[13px] text-[#171717]/70 mt-1">Renews {fmtDate(row.subscriptionEndsAt)}</p>
                  ) : null}
                  <Link
                    href={`/admin/businesses/${row.ownerId}`}
                    className="mt-3 inline-flex min-h-9 items-center text-[13px] font-semibold text-ink underline decoration-[#171717]/25 underline-offset-4"
                  >
                    Manage
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink">
                      Business
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink">
                      Plan
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink">
                      Status
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink">
                      30-day activity
                    </th>
                    <th className="px-5 py-3 text-[13px] font-semibold normal-case tracking-normal text-ink text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sorted.map((row) => (
                    <tr key={row.ownerId}>
                      <td className="px-5 py-3.5 text-[15px] font-bold text-ink">{row.businessName}</td>
                      <td className="px-5 py-3.5 text-[#171717]/70 text-xs">{row.subscriptionPlanLabel}</td>
                      <td className="px-5 py-3.5">
                        <BusinessStatusBadge
                          ownerActive={row.ownerActive}
                          subscriptionActive={row.subscriptionActive}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#171717]/70 tabular-nums">
                        {row.activity30d.sales} sales · {row.activity30d.purchases} purchases ·{" "}
                        {row.activity30d.payments} payments
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/businesses/${row.ownerId}`}
                          className="btn-ghost"
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
