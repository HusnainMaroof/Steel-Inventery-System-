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
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl tracking-tight">{title}</h1>
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            className="relative bg-white border border-neutral-900 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm tracking-widest uppercase">{title}</h2>
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-black text-lg leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {children}
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
  invert = false,
}: {
  label: string;
  value: number;
  money?: boolean;
  invert?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`border p-5 ${invert ? "bg-black text-white border-black" : "border-neutral-200"}`}
    >
      <div
        className={`text-[11px] uppercase tracking-[0.15em] mb-2 ${invert ? "text-neutral-400" : "text-neutral-500"}`}
      >
        {label}
      </div>
      <div className="text-2xl tabular-nums">
        {money ? (
          <CountUp value={value} prefix="₨ " compact />
        ) : (
          <CountUp value={value} suffix=" t" />
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
    <div className="flex items-end gap-4 h-40">
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
