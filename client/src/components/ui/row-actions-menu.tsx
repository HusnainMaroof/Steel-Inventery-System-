"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RowActionsMenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

const MENU_W = 176;
const MENU_Z_BACKDROP = 200;
const MENU_Z_PANEL = 201;

function placeMenu(btn: HTMLButtonElement, itemCount: number) {
  const rect = btn.getBoundingClientRect();
  const menuH = Math.max(44, itemCount * 40 + 8);
  let top = rect.bottom + 4;
  let left = rect.right - MENU_W;
  left = Math.max(8, Math.min(left, window.innerWidth - MENU_W - 8));
  if (top + menuH > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuH - 4);
  }
  return { top, left };
}

/**
 * Three-dot row menu rendered in a portal so it is not clipped by overflow-hidden cards.
 */
export function RowActionsMenu({
  items,
  ariaLabel = "Row actions",
  buttonClassName,
}: {
  items: RowActionsMenuItem[];
  ariaLabel?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const enabled = items.filter((i) => !i.disabled);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || enabled.length === 0) return;
    setMenuPos(placeMenu(btnRef.current, enabled.length));
  }, [open, enabled.length]);

  useEffect(() => {
    if (!open || !btnRef.current || enabled.length === 0) return;
    const reposition = () => {
      if (btnRef.current) setMenuPos(placeMenu(btnRef.current, enabled.length));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, enabled.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (enabled.length === 0) return null;

  const defaultBtnClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-black transition-colors hover:border-neutral-300 hover:bg-neutral-100";

  return (
    <span
      className="relative inline-block shrink-0 text-left"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={buttonClassName ?? defaultBtnClass}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0"
              style={{ zIndex: MENU_Z_BACKDROP }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              className="fixed w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
              style={{ top: menuPos.top, left: menuPos.left, zIndex: MENU_Z_PANEL }}
              onClick={(e) => e.stopPropagation()}
            >
              {enabled.map((it, i) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                  className={`w-full px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-neutral-100 ${
                    it.danger ? "text-[#a12b1f]" : "text-black"
                  } ${i > 0 ? "border-t border-neutral-100" : ""}`}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
