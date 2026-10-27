"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
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
    <div className="flex w-full max-w-full items-center gap-1 overflow-x-auto p-1 rounded-lg bg-neutral-100 border border-neutral-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative shrink-0 min-h-[44px] px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
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
  compact = false,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // Open the panel from the right edge when there is not enough room on the right.
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open || highlight < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const openList = () => {
    const rect = ref.current?.getBoundingClientRect();
    setAlignRight(!!rect && rect.left + Math.max(rect.width, 220) > window.innerWidth - 8);
    setHighlight(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setHighlight(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(highlight);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          // Keyboard Enter/Space are handled in onKeyDown; a synthetic click (detail 0) would toggle twice.
          if (e.detail === 0) return;
          if (open) setOpen(false);
          else openList();
        }}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-left text-sm font-medium transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          open ? "border-[#171717]/40 shadow-[0_0_0_3px_rgba(17,17,17,0.06)]" : "border-[#E5E5E5] hover:border-[#171717]/30"
        } ${compact ? "min-w-[8.5rem]" : "min-w-[180px]"}`}
      >
        <span className={`truncate ${selected ? "text-[#171717]" : "text-[#171717]/60"}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-[#171717]/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
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
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ transformOrigin: alignRight ? "top right" : "top left" }}
            className={`absolute z-50 mt-1.5 w-full min-w-[220px] overflow-hidden ${alignRight ? "right-0" : "left-0"} rounded-xl border border-[#E5E5E5] bg-white p-1 shadow-[0_16px_40px_-16px_rgba(17,17,17,0.28)]`}
          >
            <div ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
              {options.map((o, index) => {
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(index)}
                    className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm transition-colors ${
                      index === highlight ? "bg-[#F4F4F2]" : ""
                    } ${isSelected ? "font-semibold text-[#171717]" : "text-[#171717]/80"}`}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected ? (
                      <svg className="h-4 w-4 shrink-0 text-primary" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Search box that applies only when the user presses Search (or Enter), not
 * while typing. Repeated presses are debounced so one search runs per burst.
 * `value` is the applied search, so a page-level "Clear filters" also empties the box.
 */
export function SearchBar({
  value,
  onSearch,
  placeholder = "Search",
  ariaLabel,
  className = "",
  debounceMs = 250,
  format,
}: {
  value: string;
  onSearch: (query: string) => void;
  /** Optional clean-up applied while typing (for example phone formatting). */
  format?: (text: string) => string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  debounceMs?: number;
}) {
  const [text, setText] = useState(value);
  const [applied, setApplied] = useState(value);
  const timer = useRef<number | null>(null);

  // Follow outside changes to the applied value (for example "Clear filters").
  if (applied !== value) {
    setApplied(value);
    setText(value);
  }

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const runSearch = (query: string, immediate = false) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (immediate) {
      onSearch(query);
      return;
    }
    timer.current = window.setTimeout(() => onSearch(query), debounceMs);
  };

  return (
    <form
      role="search"
      className={`flex min-w-0 gap-2 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        runSearch(text.trim());
      }}
    >
      <div className="relative min-w-0 flex-1">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#171717]/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(format ? format(e.target.value) : e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className="!w-full !pl-9 !pr-16"
        />
        {text ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              runSearch("", true);
            }}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg px-2 py-1 text-[13px] font-medium text-[#171717]/70 hover:bg-[#F4F4F2] hover:text-[#171717]"
          >
            Clear
          </button>
        ) : null}
      </div>
      <button type="submit" className="btn-ghost shrink-0">
        Search
      </button>
    </form>
  );
}

/* GSAP count-up number — tweens from the previous value so data updates
   never re-animate from zero (first mount animates 0 → value). */
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
  const prevRef = useRef(0);
  // Full amounts with separators (no K/M abbreviation), up to 2 decimals.
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;
    const obj = { n: from };
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
  return <span ref={ref}>{prefix + fmt(value) + suffix}</span>;
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

/** Inline spinner for buttons — label stays visible while loading */
export function ButtonSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent opacity-90 animate-spin ${className}`}
    />
  );
}

/** Primary/ghost button that disables and shows a spinner while busy (no label swap) */
export function BusyButton({
  loading = false,
  disabled,
  children,
  className = "",
  type = "button",
  form,
  onClick,
  variant = "primary",
}: {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
  form?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  const busy = Boolean(loading);
  const base = variant === "ghost" ? "btn-ghost" : "btn-primary";
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className={`${base} inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none ${className}`}
    >
      {busy ? <ButtonSpinner /> : null}
      <span>{children}</span>
    </button>
  );
}

/**
 * Page heading. `sub` is kept for old callers but no longer shown (the owner
 * wants no filler lines under titles); pass `meta` for a short, useful fact
 * such as the selected period.
 */
export function PageTitle({
  title,
  meta,
  action,
}: {
  title: string;
  sub?: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#111] sm:text-[30px]">{title}</h1>
        {meta ? <div className="mt-1.5 text-[13px] font-medium text-[#171717]/70">{meta}</div> : null}
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

/* Modal with spring animation.
   Pass `busy` while an action is running. While busy, the backdrop and
   the X button cannot close the modal, so the user always sees the result. */
/** open modals, last = top-most (for Escape) */
const openModals: object[] = [];

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  full = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "2xl" | "3xl" | "4xl" | "6xl";
  full?: boolean;
  busy?: boolean;
}) {
  const guardedClose = () => {
    if (!busy) onClose();
  };
  // Escape closes the top-most open modal only (a payment popup over a sale popup).
  const closeRef = useRef(guardedClose);
  useLayoutEffect(() => {
    closeRef.current = guardedClose;
  });
  useEffect(() => {
    if (!open) return;
    const token = {};
    openModals.push(token);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || openModals[openModals.length - 1] !== token) return;
      event.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = openModals.indexOf(token);
      if (i >= 0) openModals.splice(i, 1);
    };
  }, [open]);
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
            onClick={guardedClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative bg-white border border-neutral-200 shadow-2xl w-full flex flex-col overflow-hidden ${
              full
                ? "max-w-[96vw] xl:max-w-[1400px] h-[94vh] sm:h-[92vh]"
                : `${maxW} max-h-[94vh] sm:max-h-[92vh]`
            } rounded-xl`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div className="flex items-start justify-between gap-4 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-neutral-100 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#171717]">{title}</h2>
              </div>
              <button
                type="button"
                onClick={guardedClose}
                disabled={busy}
                className="shrink-0 -mr-2 -mt-1 w-10 h-10 flex items-center justify-center rounded-lg text-[#171717]/60 hover:text-[#171717] hover:bg-[#F8F8F7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* the body scrolls under a fixed header, with room above the first field */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-5 sm:py-6">{children}</div>
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
  loading = false,
  error = null,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  error?: string | null;
  title?: string;
  confirmLabel?: string;
  loading?: boolean;
  children: ReactNode;
}) {
  const busy = Boolean(loading);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={title}>
      {error && (
        <div role="alert" className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5 mb-5">
          {error}
        </div>
      )}
      <div className="mb-6">{children}</div>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <BusyButton
          type="button"
          onClick={onConfirm}
          loading={busy}
          className="!bg-[#a12b1f] hover:!bg-[#8a241a]"
        >
          {confirmLabel}
        </BusyButton>
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
                ? d.value.toLocaleString("en-US", { maximumFractionDigits: 2 })
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
                −{Math.abs(d.value).toLocaleString("en-US", { maximumFractionDigits: 2 })}
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
            {d.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
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
  icon,
  title,
  hint,
  action,
  compact = false,
}: {
  emoji?: string;
  /** Prefer SVG icon over emoji for structural empty states */
  icon?: ReactNode;
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
      {icon ? (
        <div
          aria-hidden
          className={`flex items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-400 ${
            compact ? "w-12 h-12" : "w-16 h-16"
          }`}
        >
          {icon}
        </div>
      ) : emoji ? (
      <motion.span
        aria-hidden
        className={compact ? "text-3xl leading-none" : "text-5xl leading-none"}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {emoji}
      </motion.span>
      ) : null}
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

/**
 * Number field that keeps what the user typed ("14.0", "14.", "0.05").
 * A plain controlled <input type="number"> fed with Number(text) drops a
 * trailing "0" or ".", so amounts like 14.05 could not be typed.
 */
export function NumberInput({
  value,
  onValue,
  decimals = 2,
  ...rest
}: {
  value: number;
  onValue: (n: number) => void;
  /** most digits allowed after the point */
  decimals?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const show = (n: number) => (n ? String(n) : "");
  const [text, setText] = useState(() => show(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if ((Number(text) || 0) !== (value || 0)) setText(show(value));
  }
  const pattern = new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`);
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/,/g, "").trim();
        if (!pattern.test(t)) return;
        setText(t);
        onValue(Number(t) || 0);
      }}
      {...rest}
    />
  );
}

/** Inline validation / API error under a form or modal section */
export function InlineFormError({ message }: { message?: string | null }) {
  if (!message?.trim()) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-snug text-red-800"
    >
      {message}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  title: string;
  message?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center text-center px-6 py-16 max-w-md mx-auto"
    >
      <p className="text-base font-semibold text-[#a12b1f]">{title}</p>
      {message && (
        <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{message}</p>
      )}
      {onRetry && (
        <button type="button" className="btn-primary mt-5" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function PaginationBar({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-neutral-200">
      <p className="text-xs text-neutral-500 tabular-nums">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-ghost !py-1.5 !px-3 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-ghost !py-1.5 !px-3 text-xs"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export { RowActionsMenu, type RowActionsMenuItem } from "./ui/row-actions-menu";
