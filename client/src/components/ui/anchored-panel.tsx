"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/**
 * Renders `children` in a fixed-position panel anchored to `anchorRef`.
 * Fixed positioning (not absolute) so the panel escapes overflow-clipping
 * ancestors — modal bodies scroll, filter bars wrap.
 *
 * Flips above the anchor when there is no room below, clamps horizontally,
 * and repositions (stays open) on scroll/resize. Closes on outside click
 * or Escape.
 */
export function AnchoredPanel({
  anchorRef,
  open,
  onClose,
  align = "end",
  widthClass = "w-[min(680px,calc(100vw-1rem))]",
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: "start" | "end";
  widthClass?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const panelW = panelRef.current?.offsetWidth ?? Math.min(680, window.innerWidth - 16);
      const panelH = panelRef.current?.offsetHeight ?? 420;
      let left = align === "end" ? r.right - panelW : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
      let top = r.bottom + 8;
      if (top + panelH > window.innerHeight - 8) {
        // flip above when there is room, otherwise clamp to the viewport
        top =
          r.top - panelH - 8 >= 8
            ? r.top - panelH - 8
            : Math.max(8, window.innerHeight - panelH - 8);
      }
      setPos((prev) =>
        prev && prev.top === top && prev.left === left ? prev : { top, left },
      );
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      data-calendar-panel
      className={`fixed z-[60] max-h-[min(680px,calc(100vh-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-[var(--line)] bg-white shadow-2xl ring-1 ring-black/5 ${widthClass}`}
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
    >
      {children}
    </div>
  );
}
