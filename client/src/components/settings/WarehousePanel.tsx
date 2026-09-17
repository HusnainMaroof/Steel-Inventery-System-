"use client";

import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";

const offIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M18.36 6.64a9 9 0 11-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

const onIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M18.36 6.64a9 9 0 11-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-transparent text-[#171717]/70 hover:text-[#a12b1f] hover:bg-[#faf5f2] hover:border-[#f0e2de] transition-colors"
    >
      {children}
    </button>
  );
}

export function WarehousePanel() {
  const {
    warehouses,
    locations,
    addWarehouse,
    renameWarehouse,
    setWarehouseActive,
    addLocation,
    renameLocation,
    setLocationActive,
  } = useStore();
  const [openLoc, setOpenLoc] = useState<string | null>(null);
  const [openWhAdd, setOpenWhAdd] = useState(false);

  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e5e5e5] flex flex-wrap items-start justify-between gap-3">
        <p className="text-[13px] text-[#171717] leading-relaxed max-w-2xl">
          A <span className="font-medium">warehouse</span> is where you store goods.
          A <span className="font-medium">location</span> is a spot inside it.
          Pick one when recording a purchase — it shows on that lot in Inventory.
          You can leave this empty.
        </p>
        {warehouses.length > 0 && !openWhAdd && (
          <button
            type="button"
            onClick={() => setOpenWhAdd(true)}
            className="shrink-0 text-[12px] font-medium text-[#171717] px-2.5 py-1.5 rounded-md border border-[#e5e5e5] bg-white min-h-[44px]"
          >
            + Warehouse
          </button>
        )}
      </div>
      {warehouses.length === 0 ? (
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-[13px] text-[#171717]">No warehouses yet</p>
          <form
            className="w-full max-w-sm flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = (e.currentTarget.elements.namedItem("wh") as HTMLInputElement).value.trim();
              if (v) addWarehouse(v);
              e.currentTarget.reset();
            }}
          >
            <input name="wh" placeholder="e.g. Main Yard" className="flex-1" aria-label="Warehouse name" />
            <button type="submit" className="btn-primary !py-2 !px-3 text-xs min-h-[44px]">
              Add warehouse
            </button>
          </form>
        </div>
      ) : (
        <>
          {openWhAdd ? (
            <form
              className="px-4 py-3 border-b border-[#e5e5e5] flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = (e.currentTarget.elements.namedItem("wh") as HTMLInputElement).value.trim();
                if (v) addWarehouse(v);
                setOpenWhAdd(false);
              }}
            >
              <input name="wh" placeholder="New warehouse name" className="flex-1" autoFocus aria-label="New warehouse name" />
              <button type="submit" className="btn-primary !py-2 !px-3 text-xs min-h-[44px]">
                Add
              </button>
              <button type="button" className="btn-ghost !py-2 !px-3 text-xs min-h-[44px]" onClick={() => setOpenWhAdd(false)}>
                Cancel
              </button>
            </form>
          ) : null}
          <div className="divide-y divide-[#e5e5e5]">
            {warehouses.map((w) => {
              const wLocs = locations.filter((l) => l.warehouseId === w.id);
              return (
                <div key={w.id} className={`px-4 py-4 ${w.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={w.name}
                      aria-label={`Rename ${w.name}`}
                      onBlur={(e) =>
                        e.target.value.trim() && e.target.value !== w.name && renameWarehouse(w.id, e.target.value.trim())
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="flex-1 !p-0 !border-none !bg-transparent !shadow-none !text-[14px] !font-semibold"
                    />
                    <IconBtn
                      onClick={() => setWarehouseActive(w.id, !w.active)}
                      title={w.active ? "Turn warehouse off" : "Turn warehouse on"}
                    >
                      {w.active ? offIcon : onIcon}
                    </IconBtn>
                    {openLoc !== w.id ? (
                      <button
                        type="button"
                        onClick={() => setOpenLoc(w.id)}
                        className="shrink-0 text-[12px] font-medium text-[#171717] px-2.5 py-1.5 rounded-md border border-[#e5e5e5] bg-white min-h-[44px]"
                      >
                        + Location
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {wLocs
                      .filter((l) => l.active)
                      .map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center gap-1 border border-[#e5e5e5] rounded-md px-2.5 py-1 text-[12px] bg-white"
                        >
                          <input
                            defaultValue={l.name}
                            aria-label={`Rename ${l.name}`}
                            onBlur={(e) =>
                              e.target.value.trim() &&
                              e.target.value !== l.name &&
                              renameLocation(l.id, e.target.value.trim())
                            }
                            className="!p-0 !border-none !bg-transparent !shadow-none !text-[12px] !w-24"
                          />
                          <button
                            type="button"
                            onClick={() => setLocationActive(l.id, false)}
                            className="text-[#171717]/70 hover:text-[#a12b1f] w-5 h-5"
                            aria-label={`Remove ${l.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    {wLocs
                      .filter((l) => !l.active)
                      .map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLocationActive(l.id, true)}
                          className="text-[12px] text-[#171717]/70 line-through hover:text-[#171717] border border-dashed border-[#e5e5e5] rounded-md px-2.5 py-1"
                        >
                          {l.name}
                        </button>
                      ))}
                    {openLoc === w.id ? (
                      <form
                        className="flex gap-2 w-56"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const v = (e.currentTarget.elements.namedItem("loc") as HTMLInputElement).value.trim();
                          if (v) addLocation(w.id, v);
                          setOpenLoc(null);
                        }}
                      >
                        <input name="loc" placeholder="e.g. Yard A" className="flex-1 !py-1 text-[12px]" autoFocus aria-label="Location name" />
                        <button type="submit" className="btn-primary !py-1 !px-2 text-xs">
                          Add
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
