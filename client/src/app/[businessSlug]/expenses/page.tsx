"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Receipt, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { BusyButton, ConfirmModal, EmptyState, Modal, Page, PageTitle, RowActionsMenu } from "@/components/ui";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { dateInIsoRange } from "@/lib/date-range-filter";
import { DatePicker } from "@/components/ui/date-picker";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { Expense } from "@/lib/types";
import Decimal from "decimal.js";
import { toDecimal } from "../../../lib/decimal";
import { userFacingError } from "@/lib/user-error";

type DraftLine = { name: string; amount: string };

const emptyLine = (): DraftLine => ({ name: "", amount: "" });

function expenseName(e: Expense) {
  return (e.label ?? "").trim() || e.category;
}

export default function ExpensesPage() {
  const { expenses, addExpense, deleteExpense, isPending } = useStore();
  const now = new Date();
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [date, setDate] = useState(() => now.toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [view, setView] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (q && !expenseName(e).toLowerCase().includes(q)) return false;
      if (!dateInIsoRange(e.date, dateRange)) return false;
      return true;
    });
  }, [expenses, query, dateRange]);

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of [...filtered].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    )) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const total = filtered.reduce((sum, e) => sum.plus(toDecimal(e.amount)), new Decimal(0)).toNumber();
  const hasFilters = query.trim() !== "" || !!(dateRange.from || dateRange.to);

  const openAdd = () => {
    setDate(now.toISOString().slice(0, 10));
    setLines([emptyLine()]);
    setError(null);
    setAddOpen(true);
  };

  const setLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => {
      const next = current.map((line, i) => (i === index ? { ...line, ...patch } : line));
      const last = next[next.length - 1];
      if (last.name.trim() && last.amount.trim()) return [...next, emptyLine()];
      return next;
    });
    setError(null);
  };

  const [savingExpense, setSavingExpense] = useState(false);
  const savingExpenseRef = useRef(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (savingExpenseRef.current || isPending("expense:create")) return;
    const ready = lines
      .map((line) => ({
        name: line.name.trim(),
        amount: Number(line.amount),
      }))
      .filter((line) => line.name || line.amount);

    if (ready.length === 0) {
      setError("Type an expense name and amount.");
      return;
    }
    for (const line of ready) {
      if (line.name.length < 2) {
        setError("Give each expense a name.");
        return;
      }
      if (!Number.isFinite(line.amount) || line.amount <= 0) {
        setError("Amount must be more than 0.");
        return;
      }
    }
    savingExpenseRef.current = true;
    setSavingExpense(true);
    try {
      for (const line of ready) {
        await addExpense({
          date,
          label: line.name,
          category: "Other",
          amount: line.amount,
        });
      }
      setAddOpen(false);
    } catch (reason) {
      setError(userFacingError(reason, "Could not save this expense."));
    } finally {
      savingExpenseRef.current = false;
      setSavingExpense(false);
    }
  };

  return (
    <Page>
      <PageTitle
        title="Expenses"
        sub="Shop costs you type yourself: electricity, salaries, labour, rent, anything."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative min-w-[200px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search expense name"
            className="w-full"
            aria-label="Search expenses"
          />
        </div>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          placeholder="All dates"
          ariaLabel="Filter expenses by date range"
        />
        <button type="button" className="btn-primary shrink-0" onClick={openAdd}>
          + Add expense
        </button>
      </div>

      {hasFilters ? (
        <button
          type="button"
          className="text-[13px] font-medium text-[#171717]/70 underline-offset-2 hover:text-[#171717] hover:underline mb-4"
          onClick={() => {
            setQuery("");
            setDateRange({ from: null, to: null });
          }}
        >
          Clear filters
        </button>
      ) : null}

      {expenses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wide text-[#171717]/60">Records</p>
            <p className="text-2xl font-bold tabular-nums text-[#171717] mt-1">
              {filtered.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wide text-[#171717]/60">Total spent</p>
            <p className="text-2xl font-bold tabular-nums text-[#171717] mt-1">
              {fmtMoney(total)}
            </p>
          </div>
        </div>
      ) : null}

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          <EmptyState
            icon={<Receipt className="size-6" aria-hidden="true" />}
            title="No expenses yet"
            hint="Add a name and amount: electricity, salary, rent, or any cost you pay."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                + Add expense
              </button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          <EmptyState
            title="No expenses match"
            hint="Clear the filters to see every cost."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold tracking-tight text-[#171717]">
                  {fmtDate(day)}
                </span>
                <span className="text-[13px] text-[#171717]/70 tabular-nums">
                  {items.length} expense{items.length === 1 ? "" : "s"}
                </span>
                <div className="flex-1 min-w-[2rem] border-b border-[#E5E5E5]" />
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
                <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_10rem_56px] gap-3 items-center px-4 py-2.5 bg-[#FAFAF9] border-b border-[#E5E5E5] text-xs uppercase tracking-wide text-[#171717]/60">
                  <span>Name</span>
                  <span className="text-right">Amount</span>
                  <span className="sr-only">Actions</span>
                </div>
                <div className="divide-y divide-[#E5E5E5]">
                  {items.map((item) => (
                    <div key={item.id} className="px-4 py-3 transition-colors hover:bg-[#F8F8F7]">
                      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_10rem_56px] gap-3 items-center">
                        <p className="min-w-0 truncate text-sm font-medium text-[#171717]" title={expenseName(item)}>
                          {expenseName(item)}
                        </p>
                        <p className="text-right text-sm font-semibold tabular-nums text-[#171717]">
                          {fmtMoney(item.amount)}
                        </p>
                        <div className="flex justify-end">
                          <RowActionsMenu
                            items={[
                              { label: "View", onClick: () => setView(item) },
                              { label: "Delete", danger: true, onClick: () => setDeleteTarget(item) },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="sm:hidden">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#171717]">
                            {expenseName(item)}
                          </p>
                          <RowActionsMenu
                            items={[
                              { label: "View", onClick: () => setView(item) },
                              { label: "Delete", danger: true, onClick: () => setDeleteTarget(item) },
                            ]}
                          />
                        </div>
                        <p className="mt-1 text-right text-sm font-semibold tabular-nums text-[#171717]">
                          {fmtMoney(item.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        busy={savingExpense || isPending("expense:create")}
        title="Add expense"
        size="lg"
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          {error ? (
            <div
              role="alert"
              className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5"
            >
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="expense-date">Date</label>
            <DatePicker
              value={date}
              onChange={setDate}
              ariaLabel="Expense date"
              disableFuture
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-medium text-[#171717] mb-1">
              Name and amount
            </p>
            <p className="text-[13px] text-[#171717]/70 mb-2">
              Type any cost: electricity, salary, labour, transport, rent, or a new name.
            </p>
            <div className="flex flex-col gap-2">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-end">
                  <div>
                    {index === 0 ? (
                      <label htmlFor={`expense-name-${index}`}>Name</label>
                    ) : (
                      <span className="sr-only">Name</span>
                    )}
                    <input
                      id={`expense-name-${index}`}
                      value={line.name}
                      onChange={(e) => setLine(index, { name: e.target.value })}
                      placeholder="Electricity, salary, rent…"
                      autoFocus={index === 0}
                    />
                  </div>
                  <div>
                    {index === 0 ? (
                      <label htmlFor={`expense-amount-${index}`}>Amount</label>
                    ) : (
                      <span className="sr-only">Amount</span>
                    )}
                    <input
                      id={`expense-amount-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.amount}
                      onChange={(e) => setLine(index, { amount: e.target.value })}
                      placeholder="0"
                      className="text-right tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-ghost h-10 w-10 shrink-0 !px-0 mb-0.5"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost mt-3"
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              + Add another
            </button>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setAddOpen(false)}
              disabled={savingExpense || isPending("expense:create")}
            >
              Cancel
            </button>
            <BusyButton type="submit" loading={savingExpense || isPending("expense:create")}>
              Save
            </BusyButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={view ? expenseName(view) : "Expense"}
      >
        {view ? (
          <div className="space-y-3">
            <p className="text-sm text-[#171717]">
              <span className="text-[#171717]/70">Date</span>
              <span className="block mt-0.5 font-medium">{fmtDate(view.date)}</span>
            </p>
            <p className="bg-[#111] text-white font-semibold px-4 py-3 rounded-md flex justify-between">
              <span>Amount</span>
              <span className="tabular-nums">{fmtMoney(view.amount)}</span>
            </p>
            <div className="flex justify-end">
              <button type="button" className="btn-ghost" onClick={() => setView(null)}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleteError(null);
          try {
            await deleteExpense(deleteTarget.id);
            setDeleteTarget(null);
          } catch (reason) {
            setDeleteError(userFacingError(reason, "Could not delete this expense."));
          }
        }}
        error={deleteError}
        title={deleteTarget ? `Delete ${expenseName(deleteTarget)}?` : "Delete expense?"}
        confirmLabel="Delete"
        loading={deleteTarget ? isPending(`expense:delete:${deleteTarget.id}`) : false}
      >
        <p className="text-sm text-[#171717]">
          This cost will leave the list and the reports.
        </p>
      </ConfirmModal>
    </Page>
  );
}
