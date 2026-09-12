"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";

/* ---------- Tabs (Shadcn-style segmented control) ---------- */
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 border border-neutral-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
            value === t.key
              ? "bg-white text-black shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Custom Select (Shadcn-style dropdown) ---------- */
export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 w-full min-w-[180px] px-3 py-2 text-xs font-medium bg-white border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors text-left"
      >
        <span className={selected ? "text-black" : "text-neutral-400"}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {options.map((o) => (
                <button
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    o.value === value
                      ? "bg-neutral-100 text-black font-medium"
                      : "text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* GSAP count-up number */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  compact = false,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) =>
    compact
      ? Math.abs(n) >= 1e6
        ? (n / 1e6).toFixed(2) + "M"
        : Math.abs(n) >= 1e3
          ? (n / 1e3).toFixed(1) + "K"
          : Math.round(n).toLocaleString()
      : Math.round(n).toLocaleString("en-US");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { n: 0 };
    const tween = gsap.to(obj, {
      n: value,
      duration: 1,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = prefix + fmt(obj.n) + suffix;
      },
    });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefix, suffix, compact]);
  return <span ref={ref}>{prefix + fmt(0) + suffix}</span>;
}

/* Page enter animation */
export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* Staggered children reveal */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl tracking-tight">{title}</h1>
        {sub && <p className="text-neutral-500 text-xs mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* Collapsible optional block — lot details, source lots, etc. */
export function OptionalSection({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-neutral-50 hover:bg-neutral-100/80 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-neutral-800">{title}</p>
          {hint && <p className="text-[12px] text-neutral-400 mt-0.5">{hint}</p>}
        </div>
        <svg
          className={`w-4 h-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 py-4 border-t border-neutral-200 bg-white">{children}</div>}
    </div>
  );
}

/* Modal with spring animation */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "2xl" | "3xl" | "4xl" | "6xl";
  full?: boolean;
}) {
  const maxW =
    size === "6xl"
      ? "max-w-6xl"
      : size === "4xl"
        ? "max-w-4xl"
        : size === "3xl"
          ? "max-w-3xl"
          : size === "2xl"
            ? "max-w-2xl"
            : size === "lg"
              ? "max-w-3xl"
              : "max-w-xl";
  const scrollBody = full || !!footer;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.div
            className={`relative bg-white border border-neutral-200 shadow-2xl w-full flex flex-col overflow-hidden ${
              full
                ? "max-w-[96vw] xl:max-w-[1400px] h-[94vh] sm:h-[92vh]"
                : `${maxW} max-h-[94vh] sm:max-h-[92vh]`
            } ${scrollBody ? "" : "overflow-y-auto"} rounded-xl`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div className="flex items-start justify-between gap-4 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-neutral-100 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900">{title}</h2>
                {subtitle && <p className="text-[13px] text-neutral-400 mt-0.5">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {scrollBody ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-5 sm:py-6">{children}</div>
            ) : (
              <div className="px-5 sm:px-7 pb-5 sm:pb-7">{children}</div>
            )}
            {footer && (
              <div className="shrink-0 px-5 sm:px-7 py-4 border-t border-neutral-100 bg-neutral-50/50">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Destructive-action confirm dialog: summary + warning content up to the
   caller, consistent Cancel / red Delete footer everywhere. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  confirmLabel = "Delete",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  confirmLabel?: string;
  children: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mb-6">{children}</div>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn-primary !bg-[#a12b1f] hover:!bg-[#8a241a]"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* Big stat card with count-up */
export function StatCard({
  label,
  value,
  money = true,
  unit = "",
  invert = false,
}: {
  label: string;
  value: number;
  money?: boolean;
  unit?: string;
  invert?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`border p-4 sm:p-5 ${invert ? "bg-black text-white border-black" : "border-neutral-200"}`}
    >
      <div
        className={`text-[11px] uppercase tracking-[0.15em] mb-2 ${invert ? "text-neutral-400" : "text-neutral-500"}`}
      >
        {label}
      </div>
      <div className="text-xl sm:text-2xl tabular-nums">
        {money ? (
          <CountUp value={value} prefix="₨ " compact />
        ) : (
          <CountUp value={value} suffix={unit ? ` ${unit}` : ""} />
        )}
      </div>
    </motion.div>
  );
}

/* Simple monochrome bar chart (CSS bars, animated widths) — supports negative values */
export function BarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const hasNegative = data.some((d) => d.value < 0);
  if (hasNegative) {
    const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
    return (
      <div className="flex items-center gap-3 sm:gap-4 h-40 sm:h-44">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-center">
            <div className="text-[11px] text-neutral-500 tabular-nums">
              {d.value >= 0
                ? (d.value >= 1e6 ? (d.value / 1e6).toFixed(1) + "M" : Math.round(d.value).toLocaleString())
                : ""}
            </div>
            {d.value >= 0 ? (
              <motion.div
                className="w-full bg-black"
                initial={{ height: 0 }}
                animate={{ height: `${(d.value / max) * 45}%` }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : (
              <motion.div
                className="w-full bg-neutral-300"
                initial={{ height: 0 }}
                animate={{ height: `${(Math.abs(d.value) / max) * 45}%` }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <div className="w-full border-t border-neutral-300" />
            {d.value < 0 && (
              <div className="text-[11px] text-red-500 tabular-nums">
                −{Math.abs(d.value) >= 1e6 ? (Math.abs(d.value) / 1e6).toFixed(1) + "M" : Math.round(Math.abs(d.value)).toLocaleString()}
              </div>
            )}
            <div className="text-[11px] text-neutral-500 truncate w-full text-center">
              {d.label}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-3 sm:gap-4 h-36 sm:h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
          <div className="text-[11px] text-neutral-500 tabular-nums">
            {d.value >= 1e6 ? (d.value / 1e6).toFixed(1) + "M" : Math.round(d.value).toLocaleString()}
          </div>
          <motion.div
            className="w-full bg-black"
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / max) * 100}%` }}
            transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="text-[11px] text-neutral-500 truncate w-full text-center">
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function useToggle(initial = false) {
  const [open, setOpen] = useState(initial);
  return { open, setOpen, onOpen: () => setOpen(true), onClose: () => setOpen(false) };
}

/* Cute empty state — a floating emoji + friendly words for when a list has
   nothing in it yet. Use `compact` inside cards / small list areas. */
export function EmptyState({
  emoji = "🌱",
  title,
  hint,
  action,
  compact = false,
}: {
  emoji?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center justify-center text-center px-4 ${
        compact ? "py-8" : "py-14"
      }`}
    >
      <motion.span
        aria-hidden
        className={compact ? "text-3xl leading-none" : "text-5xl leading-none"}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {emoji}
      </motion.span>
      <p className={`font-medium text-neutral-800 ${compact ? "text-sm mt-3" : "mt-4"}`}>
        {title}
      </p>
      {hint && (
        <p className="text-xs text-neutral-400 mt-1.5 max-w-xs leading-relaxed">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
