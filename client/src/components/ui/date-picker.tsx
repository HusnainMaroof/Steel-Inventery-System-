"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { AnchoredPanel } from "@/components/ui/anchored-panel";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { parseISODate, toISODate, rangeTriggerClass } from "@/components/ui/date-range-picker";

/**
 * Shared single-date picker (shadcn Calendar in a popover) for form fields
 * — New Sale, Receive Payment, Add Purchase, Add Expense. Fixed-position
 * panel so it escapes modal-body overflow clipping.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  ariaLabel = "Pick a date",
  className = "",
  disableFuture = false,
  allowClear = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disableFuture?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = parseISODate(value);
  const now = new Date();

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(rangeTriggerClass, value && "border-neutral-900")}
      >
        <CalendarDays className="size-4 shrink-0 text-neutral-400" />
        <span className="truncate">{value ? fmtDate(value) : placeholder}</span>
      </button>

      <AnchoredPanel
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        widthClass="w-[min(340px,calc(100vw-1rem))]"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? toISODate(d) : "");
            setOpen(false);
          }}
          defaultMonth={selected}
          disabled={disableFuture ? { after: now } : undefined}
          footer={
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange(toISODate(now));
                  setOpen(false);
                }}
                className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
              >
                Today
              </button>
              {allowClear && value ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-xs font-medium text-neutral-400 underline underline-offset-2 hover:text-neutral-900"
                >
                  Clear
                </button>
              ) : (
                <span />
              )}
            </div>
          }
        />
      </AnchoredPanel>
    </div>
  );
}
