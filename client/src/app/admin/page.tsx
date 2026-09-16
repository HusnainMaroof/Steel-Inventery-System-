"use client";

import { useState } from "react";
import { useAuth, type OwnerAccount } from "@/lib/auth";
import {
  ConfirmModal,
  EmptyState,
  Modal,
  Page,
} from "@/components/ui";

export default function AdminPage() {
  const { owners, addOwner, deleteOwner } = useAuth();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OwnerAccount | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Page>
      {/* ===== header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl tracking-tight">Owners</h1>
          <p className="text-neutral-500 text-xs mt-1">
            Business owners who can sign in — each runs the ledger with their
            own business name on top.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="btn-primary !py-2.5 !px-4"
        >
          + Add owner
        </button>
      </div>

      {owners.length === 0 ? (
        <div className="panel">
          <EmptyState
            emoji="🧾"
            title="No owners yet"
            hint="Add the first business owner — you give them their login, and their business name shows on their dashboard."
            action={
              <button
                onClick={() => setAddOpen(true)}
                className="btn-primary"
              >
                + Add owner
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* ===== desktop list ===== */}
          <div className="panel overflow-hidden dt-desktop">
            <table>
              <thead>
                <tr>
                  <th>Business name</th>
                  <th>Owner</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id}>
                    <td className="font-semibold text-[#171717]">
                      {o.businessName}
                    </td>
                    <td className="text-neutral-700">{o.name}</td>
                    <td className="font-mono text-[13px] text-neutral-700">
                      {o.username}
                    </td>
                    <td className="font-mono text-[13px] text-neutral-700">
                      <span className="flex items-center gap-2">
                        {revealed.has(o.id) ? o.password : "••••••••"}
                        <button
                          onClick={() => toggleReveal(o.id)}
                          className="text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-400 hover:text-black"
                        >
                          {revealed.has(o.id) ? "Hide" : "Show"}
                        </button>
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setDeleteTarget(o)}
                        className="text-[11px] uppercase tracking-[0.1em] font-medium text-neutral-400 hover:text-[#a12b1f] transition-colors px-2 py-1.5 rounded-sm hover:bg-[#faf5f2]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== mobile cards ===== */}
          <div className="dt-mobile panel divide-y divide-[#e5e5e5]">
            {owners.map((o) => (
              <div key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#171717] truncate">
                      {o.businessName}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">{o.name}</p>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(o)}
                    className="shrink-0 text-[11px] uppercase tracking-[0.1em] font-medium text-neutral-400 hover:text-[#a12b1f] px-2 py-1.5"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                  <p className="text-neutral-500">
                    Username:{" "}
                    <span className="font-mono text-neutral-800">{o.username}</span>
                  </p>
                  <p className="text-neutral-500">
                    Password:{" "}
                    <span className="font-mono text-neutral-800">
                      {revealed.has(o.id) ? o.password : "••••••••"}
                    </span>
                    <button
                      onClick={() => toggleReveal(o.id)}
                      className="ml-2 text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-400 hover:text-black"
                    >
                      {revealed.has(o.id) ? "Hide" : "Show"}
                    </button>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <AddOwnerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(o) => {
          const err = addOwner(o);
          return err;
        }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteOwner(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete this owner?"
      >
        {deleteTarget && (
          <>
            <p className="text-sm text-neutral-700 leading-relaxed">
              <span className="font-semibold text-[#171717]">
                {deleteTarget.businessName}
              </span>{" "}
              ({deleteTarget.name}, {deleteTarget.username}) will lose access
              to the ledger.
            </p>
            <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
              Their login stops working and they can no longer sign in. Their
              records and numbers are not touched — only the account. This
              cannot be undone.
            </p>
          </>
        )}
      </ConfirmModal>
    </Page>
  );
}

/* ---------- add-owner popup ---------- */
function AddOwnerModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (o: Omit<OwnerAccount, "id">) => string | null;
}) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    setName("");
    setBusinessName("");
    setUsername("");
    setPassword("");
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = onAdd({ name, businessName, username, password });
    if (err) {
      setError(err);
      return;
    }
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Add owner">
      {error && (
        <div
          role="alert"
          className="text-[13px] font-medium text-[#a12b1f] bg-[#faf5f2] border border-[#f0e2de] rounded-md px-3.5 py-2.5 mb-5"
        >
          {error}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="owner-name">Owner name</label>
            <input
              id="owner-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. M. Shazib"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="owner-business">Business / factory name</label>
            <input
              id="owner-business"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Shown on their dashboard"
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="owner-username">Username</label>
            <input
              id="owner-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Their sign-in name"
              autoCapitalize="none"
            />
          </div>
          <div>
            <label htmlFor="owner-password">Password</label>
            <input
              id="owner-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Give them a password"
            />
          </div>
        </div>
        <p className="text-xs text-neutral-500 leading-relaxed">
          The owner signs in with this username and password. After login, their
          business name appears at the top of their dashboard.
        </p>
        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn-ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Add owner
          </button>
        </div>
      </form>
    </Modal>
  );
}
