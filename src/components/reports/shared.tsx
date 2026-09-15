import { fmtCompact, fmtMoney, fmtNum } from "@/lib/format";

export function Kpi({
  label,
  value,
  compact = true,
  money = true,
  tone,
  dark,
}: {
  label: string;
  value: number;
  compact?: boolean;
  money?: boolean;
  tone?: "due" | "ok";
  dark?: boolean;
}) {
  const color = dark
    ? "text-white"
    : tone === "due" && value > 0
      ? "text-[#a12b1f]"
      : tone === "ok" && value < 0
        ? "text-[#a12b1f]"
        : tone === "ok"
          ? "text-[#2e6b2e]"
          : "text-black";
  const shown = money ? (compact ? fmtCompact(value) : fmtMoney(value)) : fmtNum(value);
  return (
    <div className={`p-4 sm:p-5 ${dark ? "bg-[#111] border border-[#111]" : "border border-neutral-200 bg-white"}`}>
      <p className={`text-[11px] uppercase tracking-widest font-medium ${dark ? "text-white" : "text-black/60"}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl sm:text-[28px] font-bold tabular-nums leading-none ${color}`}>
        {shown}
      </p>
    </div>
  );
}

export function MoneyRow({
  label,
  value,
  text,
  strong,
  line,
}: {
  label: string;
  value?: number;
  text?: string;
  strong?: boolean;
  line?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 py-2.5 text-[14px] ${
        line ? "border-t border-neutral-300 mt-1 pt-3" : ""
      } ${strong ? "font-bold" : ""}`}
    >
      <span className={strong ? "text-black" : "text-black/60"}>{label}</span>
      <span className="tabular-nums text-black">{text ?? fmtMoney(value ?? 0)}</span>
    </div>
  );
}
