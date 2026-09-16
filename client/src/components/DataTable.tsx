"use client";

import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type Row,
  flexRender,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode } from "react";

/* ---- extended column meta for responsive card layout ---- */
export interface DataTableColumnMeta {
  /** Hide this column on mobile (≤640px) */
  hiddenOnMobile?: boolean;
  /** How this column renders in the mobile card view */
  card?: {
    position: "primary" | "secondary" | "badge" | "date" | "amount" | "meta";
  };
  /** Align: "num" adds right-align + tabular-nums */
  align?: "left" | "right";
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> extends DataTableColumnMeta {}
}

/* ---- shared row animation variants ---- */
const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

/* ---- main DataTable component ---- */
export function DataTable<TData>({
  columns,
  data,
  className = "",
  compact = false,
  onRowClick,
  getRowId,
  footer,
  emptyMessage = "No data yet",
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  className?: string;
  compact?: boolean;
  onRowClick?: (row: Row<TData>) => void;
  getRowId?: (row: TData, index: number) => string;
  footer?: ReactNode;
  emptyMessage?: string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId as ((row: TData) => string) | undefined,
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  if (data.length === 0) {
    return (
      <div className="border border-neutral-200 p-8 text-center text-sm text-neutral-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`border border-neutral-200 overflow-x-auto ${className}`}>
      {/* ===== Desktop table (hidden on mobile via CSS) ===== */}
      <table className="dt-desktop">
        <thead>
          {headerGroups.map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
                return (
                  <th
                    key={header.id}
                    className={meta?.hiddenOnMobile ? "hidden md:table-cell" : ""}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.tr
                key={row.id}
                variants={rowVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
                  return (
                    <td
                      key={cell.id}
                      className={[
                        meta?.hiddenOnMobile ? "hidden md:table-cell" : "",
                        meta?.align === "right" ? "num" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>

      {/* ===== Mobile card view (hidden on desktop via CSS) ===== */}
      <div className="dt-mobile divide-y divide-neutral-100">
        <AnimatePresence initial={false}>
          {rows.map((row) => {
            const cells = row.getVisibleCells();
            const primary = cells.find((c) => (c.column.columnDef.meta as DataTableColumnMeta)?.card?.position === "primary");
            const secondary = cells.find((c) => (c.column.columnDef.meta as DataTableColumnMeta)?.card?.position === "secondary");
            const badge = cells.find((c) => (c.column.columnDef.meta as DataTableColumnMeta)?.card?.position === "badge");
            const date = cells.find((c) => (c.column.columnDef.meta as DataTableColumnMeta)?.card?.position === "date");
            const amount = cells.find((c) => (c.column.columnDef.meta as DataTableColumnMeta)?.card?.position === "amount");
            const metaCells = cells.filter((c) => (c.column.columnDef.meta as DataTableColumnMeta)?.card?.position === "meta");

            return (
              <motion.div
                key={row.id}
                variants={rowVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => onRowClick?.(row)}
                className={`p-3 ${onRowClick ? "cursor-pointer active:bg-neutral-50" : ""}`}
              >
                {/* Row 1: primary + badge */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-sm truncate">
                    {primary ? flexRender(primary.column.columnDef.cell, primary.getContext()) : "—"}
                  </span>
                  {badge && (
                    <span className="shrink-0">
                      {flexRender(badge.column.columnDef.cell, badge.getContext())}
                    </span>
                  )}
                </div>
                {/* Row 2: secondary + date */}
                {(secondary || date) && (
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    {secondary && (
                      <span className="text-xs text-neutral-500 truncate">
                        {flexRender(secondary.column.columnDef.cell, secondary.getContext())}
                      </span>
                    )}
                    {date && (
                      <span className="text-xs text-neutral-400 shrink-0">
                        {flexRender(date.column.columnDef.cell, date.getContext())}
                      </span>
                    )}
                  </div>
                )}
                {/* Row 3: amount + meta fields */}
                <div className="flex items-center justify-between gap-2">
                  {amount && (
                    <span className="text-sm font-medium tabular-nums">
                      {flexRender(amount.column.columnDef.cell, amount.getContext())}
                    </span>
                  )}
                  {metaCells.length > 0 && (
                    <span className="text-xs text-neutral-400">
                      {metaCells.map((m) => (
                        <span key={m.id} className="ml-2">
                          {flexRender(m.column.columnDef.cell, m.getContext())}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
