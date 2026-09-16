"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtSignedMoney } from "@/lib/format";

export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-6 sm:mb-8 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3 min-h-[44px]">
        <h2 className="text-[11px] uppercase tracking-widest font-semibold text-[#171717]">
          {title}
        </h2>
        {action}
      </div>
      <div className="border border-[#E5E5E5] bg-white rounded-[8px] p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

export function StatementRow({
  label,
  value,
  text,
}: {
  label: string;
  value?: number;
  text?: string;
}) {
  const shown = text ?? fmtSignedMoney(value ?? 0);
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
      <span className="text-[#171717]/70">{label}</span>
      <span className="tabular-nums font-medium text-[#171717] text-right">{shown}</span>
    </div>
  );
}

export function StatementRule() {
  return <div className="border-t border-[#171717] my-1" aria-hidden />;
}

export function StatementTotal({
  label,
  value,
  dark,
}: {
  label: string;
  value: number;
  dark?: boolean;
}) {
  if (dark) {
    return (
      <div className="flex items-baseline justify-between gap-4 mt-2 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 bg-[#111]">
        <span className="text-[12px] uppercase tracking-widest font-semibold text-white">{label}</span>
        <span className="tabular-nums text-[18px] sm:text-[20px] font-bold text-white">
          {fmtSignedMoney(value)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-t border-[#171717] mt-1">
      <span className="text-[12px] uppercase tracking-widest font-semibold text-[#171717]">{label}</span>
      <span className="tabular-nums text-[16px] font-bold text-[#171717]">{fmtSignedMoney(value)}</span>
    </div>
  );
}

export function ExportMenu({
  onExcel,
  onPdf,
}: {
  onExcel: () => void;
  onPdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 min-h-[44px] min-w-[8.5rem] px-3 py-2 text-xs font-medium bg-white border border-[#E5E5E5] rounded-[6px] hover:border-[#171717] text-[#171717]"
      >
        Export
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-full bg-white border border-[#E5E5E5] rounded-[8px] overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2.5 text-xs font-medium text-[#171717] hover:bg-[#F8F8F7] min-h-[44px]"
            onClick={() => {
              onExcel();
              setOpen(false);
            }}
          >
            Export Excel
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2.5 text-xs font-medium text-[#171717] hover:bg-[#F8F8F7] min-h-[44px] border-t border-[#E5E5E5]"
            onClick={() => {
              onPdf();
              setOpen(false);
            }}
          >
            Export PDF
          </button>
        </div>
      )}
    </div>
  );
}
