"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";

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

/* Modal with spring animation */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "2xl" | "3xl" | "4xl" | "6xl";
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
            : "max-w-lg"; // default "md" keeps the historical width
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            className={`relative bg-white border border-neutral-900 w-full ${
              full
                ? "max-w-[90vw] xl:max-w-6xl w-[90vw] h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden"
                : `${maxW} max-h-[94vh] sm:max-h-[92vh] overflow-y-auto`
            } p-5 sm:p-7`}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div
              className={`flex items-center justify-between ${
                full ? "mb-5 shrink-0" : "mb-6"
              }`}
            >
              <h2 className="text-sm tracking-widest uppercase">{title}</h2>
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-black text-lg leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {full ? (
              <div className="flex-1 min-h-0 overflow-y-auto">
                {children}
              </div>
            ) : (
              children
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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

/* Simple monochrome bar chart (CSS bars, animated widths) */
export function BarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
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
