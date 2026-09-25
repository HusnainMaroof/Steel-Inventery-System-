import { DashboardHeader } from "@/components/marketing/landing/DashboardHeader";
import { DashboardKpi } from "@/components/marketing/landing/DashboardKpi";
import { DashboardSidebar } from "@/components/marketing/landing/DashboardSidebar";
import { RevenueBySource } from "@/components/marketing/landing/RevenueBySource";
import { RevenueOverview } from "@/components/marketing/landing/RevenueOverview";

const kpis = [
  {
    label: "Total revenue",
    value: "₹7,93,981",
    change: "+12%",
    direction: "up",
    tone: "revenue",
    spark: "M2 16 C 10 16, 14 12, 20 11 S 32 14, 40 7 48 8, 52 4",
  },
  {
    label: "New customers",
    value: "88",
    change: "+8%",
    direction: "up",
    tone: "customers",
    spark: "M2 14 C 12 15, 16 8, 26 9 S 38 13, 52 5",
  },
  {
    label: "Total sales",
    value: "164",
    change: "+24%",
    direction: "up",
    tone: "sales",
    spark: "M2 17 C 10 16, 16 12, 24 13 S 36 8, 52 3",
  },
  {
    label: "Pending dues",
    value: "132",
    change: "-10%",
    direction: "down",
    tone: "dues",
    spark: "M2 6 C 12 7, 18 12, 28 13 S 40 16, 52 18",
  },
] as const;

export function DashboardPreview() {
  return (
    <div
      className="relative z-[5] mx-auto mt-[18px] w-full rounded-[16px] border border-[rgba(23,23,23,0.2)] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.06),0_35px_80px_rgba(0,0,0,0.12)]"
      id="product"
    >
      <div className="grid h-[80vh] grid-cols-[172px_minmax(0,1fr)] overflow-hidden rounded-[16px] bg-white max-[1024px]:grid-cols-[156px_minmax(0,1fr)] max-[640px]:grid-cols-1" aria-hidden="true">
        <DashboardSidebar />
        <div className="flex min-h-0 min-w-0 flex-col bg-[#F8F8F7] px-5 pt-4 pb-4">
          <DashboardHeader />
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-[34px] font-semibold tracking-[-0.03em] text-[#111] max-[640px]:text-[26px]">Dashboard</h2>
              <p className="mt-1 mb-0 text-[14px] text-[rgba(23,23,23,0.7)]">Here&apos;s what&apos;s happening with your business today.</p>
            </div>
            <div className="inline-flex h-9 items-center rounded-[6px] border border-[#E5E5E5] bg-white px-3 text-[13px] whitespace-nowrap text-[#171717] max-[768px]:hidden">
              01 Jan 2024 – 31 Dec 2024
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3 max-[768px]:grid-cols-2">
            {kpis.map((kpi) => (
              <DashboardKpi key={kpi.label} {...kpi} />
            ))}
          </div>
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-[1.45fr_0.8fr] gap-3 max-[768px]:grid-cols-1">
            <RevenueOverview />
            <RevenueBySource />
          </div>
        </div>
      </div>
    </div>
  );
}
