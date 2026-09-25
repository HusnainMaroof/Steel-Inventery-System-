const strokes = {
  revenue: "#7C6AED",
  customers: "#2FBF71",
  sales: "#3B82F6",
  dues: "#F5A524",
} as const;

export function DashboardKpi({
  label,
  value,
  change,
  direction,
  tone,
  spark,
}: {
  label: string;
  value: string;
  change: string;
  direction: "up" | "down";
  tone: keyof typeof strokes;
  spark: string;
}) {
  return (
    <article className="rounded-[8px] border border-[#E5E5E5] bg-white px-3.5 pt-3.5 pb-3">
      <p className="m-0 text-[12px] font-semibold tracking-[0.08em] text-[rgba(23,23,23,0.62)] uppercase">{label}</p>
      <p className="mt-2 mb-0 text-[32px] font-semibold tracking-[-0.03em] text-[#111] tabular-nums max-[640px]:text-[24px]">{value}</p>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <span className={`text-[13px] font-semibold ${direction === "up" ? "text-[#17824A]" : "text-[#D97706]"}`}>{change}</span>
        <svg className="h-7 w-[64px]" viewBox="0 0 54 22" aria-hidden="true">
          <path d={spark} fill="none" stroke={strokes[tone]} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </article>
  );
}
