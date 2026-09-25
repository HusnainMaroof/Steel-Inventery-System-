"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { BusyButton, ConfirmModal, EmptyState, Modal, Page, PageTitle } from "@/components/ui";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { dateInIsoRange } from "@/lib/date-range-filter";
import { DatePicker } from "@/components/ui/date-picker";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { Expense } from "@/lib/types";

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

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
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

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (isPending("expense:create")) return;
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
    for (const line of ready) {
      await addExpense({
        date,
        label: line.name,
        category: "Other",
        amount: line.amount,
      });
    }
    setAddOpen(false);
  };

  return (
    <Page>
      <PageTitle
        title="Expenses"
        sub="Shop costs you type yourself — electricity, salaries, labour, rent, anything."
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search expense name…"
          className="flex-1 min-w-[200px]"
          aria-label="Search expenses"
        />
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
          className="text-xs font-medium text-[#171717] underline-offset-2 hover:underline mb-4"
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
          <div className="panel p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-[#171717]/70">
              Records
            </p>
            <p className="text-[28px] sm:text-[32px] font-semibold tabular-nums text-[#171717] mt-1">
              {filtered.length}
            </p>
          </div>
          <div className="panel p-5 bg-[#111] text-white">
            <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-white/70">
              Total spent
            </p>
            <p className="text-[28px] sm:text-[32px] font-semibold tabular-nums mt-1">
              <span className="text-white">{fmtMoney(total)}</span>
            </p>
          </div>
        </div>
      ) : null}

      {expenses.length === 0 ? (
        <div className="panel">
          <EmptyState
            emoji="💡"
            title="No expenses yet"
            hint="Add a name and amount — electricity, salary, rent, or any cost you pay."
            action={
              <button type="button" className="btn-primary" onClick={openAdd}>
                + Add expense
              </button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          <EmptyState
            emoji=""
            title="No expenses match"
            hint="Clear the filters to see every cost."
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="text-sm font-semibold text-[#171717] pb-2 mb-3 border-b border-[#e5e5e5]">
                {fmtDate(day)}
              </h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <article key={item.id} className="panel overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[1fr_10rem_auto] gap-3 items-center px-4 py-3">
                      <p className="font-semibold text-[#171717] truncate">{expenseName(item)}</p>
                      <p className="text-right font-bold tabular-nums text-[#171717]">
                        {fmtMoney(item.amount)}
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-ghost !py-1.5 !px-3 text-xs"
                          onClick={() => setView(item)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn-ghost !py-1.5 !px-3 text-xs text-[#a12b1f] shadow-md hover:shadow-lg"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="sm:hidden p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-[#171717]">{expenseName(item)}</p>
                        <p className="font-bold tabular-nums text-[#171717] shrink-0">
                          {fmtMoney(item.amount)}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          className="btn-ghost !py-1.5 !px-3 text-xs"
                          onClick={() => setView(item)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn-ghost !py-1.5 !px-3 text-xs text-[#a12b1f] shadow-md hover:shadow-lg"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add expense" size="lg">
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
            <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-[#171717] mb-1">
              Name and amount
            </p>
            <p className="text-[13px] text-[#171717]/70 mb-2">
              Type any cost — electricity, salary, labour, transport, rent, or a new name.
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
                    className="btn-ghost !py-2 !px-2 mb-0.5"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost !py-2 !px-3 text-xs mt-3"
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              + Add another
            </button>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <BusyButton type="submit" loading={isPending("expense:create")}>
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
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteExpense(deleteTarget.id);
          setDeleteTarget(null);
        }}
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
