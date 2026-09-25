"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, Search, TriangleAlert, X } from "lucide-react";
import { AnchoredPanel } from "@/components/ui/anchored-panel";
import { cn } from "@/lib/utils";
import { fmtDate, MONTHS } from "@/lib/format";
import { normalizeIsoRange, type IsoRange } from "@/lib/date-range-filter";

export type { IsoRange };
export { normalizeIsoRange };

/** "yyyy-MM-dd" → local Date (never UTC-shifted), or undefined when empty. */
export function parseISODate(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");

/** Inclusive calendar range covering today and the previous `days - 1` days (days=2 → yesterday + today). */
export function lastNDaysRange(days: number): IsoRange {
  const to = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (Math.max(1, days) - 1));
  return { from: toISODate(from), to: toISODate(to) };
}

export function formatRangeLabel(from: string | null | undefined, to: string | null | undefined, placeholder: string) {
  if (from && to) {
    return from === to
      ? fmtDate(from)
      : `From ${fmtDate(from)} to ${fmtDate(to)}`;
  }
  if (from) return `From ${fmtDate(from)}`;
  if (to) return `Until ${fmtDate(to)}`;
  return placeholder;
}

export const rangeTriggerClass =
  "inline-flex h-10 w-auto min-w-0 items-center gap-2 whitespace-nowrap rounded-md border border-[var(--line)] bg-white px-3 text-[13px] font-medium text-neutral-900 transition-colors hover:border-neutral-900";

const pad2 = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

type DateParts = { d: string | null; m: string | null; y: string };

function partsOf(iso: string | null | undefined): DateParts {
  if (!iso) return { d: null, m: null, y: "" };
  const [y, m, d] = iso.split("-");
  return { d: d ?? null, m: m ?? null, y: y ?? "" };
}

const selectCls =
  "h-10 w-full cursor-pointer appearance-none rounded-md border border-[var(--line)] bg-white pl-2.5 pr-7 text-[13px] font-medium text-neutral-900 transition-colors hover:border-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-300";

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        className={selectCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

/* One From/To row: day, month, year dropdowns. Keeps partial picks in local
   state so choosing month before day does not reset the row. */
function DateRow({
  label,
  iso,
  onChange,
  maxDate,
  hasError,
}: {
  label: string;
  iso: string | null;
  onChange: (iso: string | null) => void;
  maxDate?: Date;
  hasError?: boolean;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const [parts, setParts] = useState<DateParts>(() => {
    const p = partsOf(iso);
    return { ...p, y: p.y || String(currentYear) };
  });

  useEffect(() => {
    if (iso) {
      const p = partsOf(iso);
      setParts({ ...p, y: p.y || String(currentYear) });
    }
  }, [iso, currentYear]);

  const year = parts.y || String(currentYear);

  const years: string[] = [];
  for (let y = currentYear + 1; y >= currentYear - 6; y--) {
    if (maxDate && y > maxDate.getFullYear()) continue;
    years.push(String(y));
  }

  const buildIso = (p: DateParts): string | null => {
    const y = p.y || String(currentYear);
    if (!p.d || !p.m) return null;
    const dim = daysInMonth(Number(y), Number(p.m));
    return `${y}-${p.m}-${pad2(Math.min(Number(p.d), dim))}`;
  };

  const applyParts = (next: DateParts) => {
    const withYear = { ...next, y: next.y || String(currentYear) };
    setParts(withYear);
    onChange(buildIso(withYear));
  };

  const setDayOrMonth = (field: "d" | "m", value: string) => {
    applyParts({ ...parts, y: year, [field]: value || null });
  };

  const dim = parts.m ? daysInMonth(Number(year), Number(parts.m)) : 31;
  const days = Array.from({ length: dim }, (_, i) => pad2(i + 1));
  const dayDisabled = (d: string) => {
    if (!maxDate || !parts.m) return false;
    const dt = new Date(Number(year), Number(parts.m) - 1, Number(d));
    return dt > maxDate;
  };
  const monthDisabled = (m: string) => {
    if (!maxDate) return false;
    return new Date(Number(year), Number(m) - 1, 1) > maxDate;
  };

  return (
    <div className="min-w-0 flex-1">
      <span
        className={cn(
          "mb-1 block text-[10px] font-semibold uppercase tracking-wider",
          hasError ? "text-[#b45309]" : "text-neutral-400",
        )}
      >
        {label}
      </span>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-[72px_1fr_84px]">
        <Select label={`${label} day`} value={parts.d ?? ""} onChange={(v) => setDayOrMonth("d", v)}>
          <option value="" disabled>
            Day
          </option>
          {days.map((d) => (
            <option key={d} value={d} disabled={dayDisabled(d)}>
              {Number(d)}
            </option>
          ))}
        </Select>
        <Select label={`${label} month`} value={parts.m ?? ""} onChange={(v) => setDayOrMonth("m", v)}>
          <option value="" disabled>
            Month
          </option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value} disabled={monthDisabled(m.value)}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select
          label={`${label} year`}
          value={year}
          onChange={(y) => applyParts({ ...parts, y })}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

/**
 * Shared From/To date-range filter: day/month/year dropdowns per end (no
 * dual-month calendar), quick presets, and a highlighted Search button.
 * Values flow as "yyyy-MM-dd" strings — the same shape every dashboard tab
 * already stores. Nothing is applied until Search is pressed.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "All dates",
  ariaLabel = "Filter by date range",
  className = "",
  disableFuture = false,
  onClear,
}: {
  from?: string | null;
  to?: string | null;
  onChange: (range: IsoRange) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disableFuture?: boolean;
  /** When set, "Remove filter" / clear chip resets to this range instead of empty. */
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Selections stay in a draft until "Search" is pressed.
  const [draft, setDraft] = useState<IsoRange | null>(null);
  const active = !!(from || to);
  const maxDate = disableFuture ? new Date() : undefined;

  const invalid = !!(
    draft?.from &&
    draft?.to &&
    draft.to < draft.from
  );

  const applySearch = () => {
    if (invalid) return;
    const raw = draft ?? { from: from ?? null, to: to ?? null };
    const next = normalizeIsoRange(raw);
    if (!next.from && !next.to) return;
    onChange(next);
    setDraft(next);
    setOpen(false);
  };

  const commitRange = (range: IsoRange) => {
    const next = normalizeIsoRange(range);
    setDraft(next);
    onChange(next);
    setOpen(false);
  };

  const applyPreset = (r: IsoRange) => commitRange(r);

  const now = new Date();
  const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const presets: { label: string; range: () => IsoRange }[] = [
    {
      label: "Last 2 days",
      range: () => lastNDaysRange(2),
    },
    {
      label: "This month",
      range: () => ({ from: toISODate(monthStart(now)), to: toISODate(monthEnd(now)) }),
    },
    {
      label: "Last month",
      range: () => {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { from: toISODate(monthStart(prev)), to: toISODate(monthEnd(prev)) };
      },
    },
    {
      label: "This year",
      range: () => ({
        from: `${now.getFullYear()}-01-01`,
        to: `${now.getFullYear()}-12-31`,
      }),
    },
  ];

  const label = formatRangeLabel(from, to, placeholder);
  const pendingPreview = normalizeIsoRange(draft ?? { from: null, to: null });
  const canSearch =
    !invalid && !!(pendingPreview.from || pendingPreview.to || draft?.from || draft?.to);

  const appliedRange = !active
    ? null
    : from && to
      ? from === to
        ? `Showing ${fmtDate(from)}`
        : `Showing from ${fmtDate(from)} to ${fmtDate(to)}`
      : from
        ? `Showing from ${fmtDate(from)}`
        : `Showing until ${fmtDate(to ?? "")}`;

  const clearAll = () => {
    if (onClear) {
      onClear();
      setOpen(false);
      return;
    }
    setDraft({ from: null, to: null });
    onChange({ from: null, to: null });
  };

  return (
    <div className={cn("relative inline-flex max-w-full flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          // (re)start the draft from the committed range
          setDraft({ from: from ?? null, to: to ?? null });
          setOpen((o) => !o);
        }}
        className={cn(
          rangeTriggerClass,
          "max-w-[min(100%,32rem)]",
          active &&
            "border-[#171717] bg-[#171717] text-white shadow-sm hover:bg-black hover:border-black",
        )}
        title={active ? label : undefined}
      >
        <CalendarDays className={cn("size-4 shrink-0", active ? "text-white" : "text-neutral-400")} />
        <span className="truncate text-left">{label}</span>
        {active ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear date range — ${appliedRange ?? ""}`}
            className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-white/60 hover:bg-white/15 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                clearAll();
              }
            }}
          >
            <X className="size-3" />
          </span>
        ) : null}
      </button>

      <AnchoredPanel
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        widthClass="w-[min(400px,calc(100vw-1rem))]"
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] px-3 py-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.range())}
              className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (onClear) {
                onClear();
                setOpen(false);
              } else {
                applyPreset({ from: null, to: null });
              }
            }}
            className="text-xs font-medium text-neutral-400 underline underline-offset-2 hover:text-neutral-900"
          >
            Clear
          </button>
        </div>

        <div className="space-y-3 px-3 py-3">
          {open ? (
            <>
              <DateRow
                label="From"
                iso={draft?.from ?? null}
                onChange={(iso) => setDraft((prev) => ({ from: iso, to: prev?.to ?? null }))}
                maxDate={maxDate}
              />
              <DateRow
                label="To"
                iso={draft?.to ?? null}
                onChange={(iso) => setDraft((prev) => ({ from: prev?.from ?? null, to: iso }))}
                maxDate={maxDate}
                hasError={invalid}
              />
            </>
          ) : null}
        </div>

        {open && canSearch ? (
          <p className="mx-3 mb-2 text-[12px] text-neutral-600">
            <span className="font-medium text-neutral-800">Will filter: </span>
            {formatRangeLabel(pendingPreview.from, pendingPreview.to, "—")}
          </p>
        ) : open ? (
          <p className="mx-3 mb-2 text-[12px] text-neutral-500">Pick at least one complete date (day + month), then Search.</p>
        ) : null}

        {invalid ? (
          <p
            role="alert"
            aria-live="polite"
            className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-[#fdba74] bg-[#fff7ed] px-3 py-2 text-[12px] font-medium text-[#b45309]"
          >
            <TriangleAlert className="size-4 shrink-0" />
            You can&apos;t do this — the To date must be the same day or after the From date.
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] px-3 py-2">
          {active ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-neutral-400 underline underline-offset-2 hover:text-neutral-900"
            >
              Remove filter
            </button>
          ) : null}
          <button
            type="button"
            onClick={applySearch}
            disabled={invalid || !canSearch}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#171717] px-4 py-2 text-xs font-semibold text-white shadow-sm ring-2 ring-[#171717]/15 transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:ring-neutral-200"
          >
            <Search className="size-3.5" />
            Search
          </button>
        </div>
      </AnchoredPanel>
    </div>
  );
}
