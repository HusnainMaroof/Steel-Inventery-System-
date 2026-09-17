"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createOwnerAction,
  listOwnersAction,
  removeOwnerAction,
  updateOwnerAction,
  type OwnerAccount,
} from "@/app/actions/users";
import { useAuth } from "@/lib/auth";
import { EmptyState, Modal, Page } from "@/components/ui";

function fmtDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {active ? "Active" : "Revoked"}
    </span>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [owners, setOwners] = useState<OwnerAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [resetOwner, setResetOwner] = useState<OwnerAccount | null>(null);

  const refresh = async () => {
    const result = await listOwnersAction();
    if (!result.ok) return setLoadError(result.error);
    setOwners(result.owners);
    setLoadError(null);
  };

  useEffect(() => {
    if (user?.role !== "SUPERADMIN") return;
    void refresh();
  }, [user?.role]);

  const stats = useMemo(() => {
    const active = owners.filter((owner) => owner.active).length;
    return { total: owners.length, active, revoked: owners.length - active };
  }, [owners]);

  if (user?.role !== "SUPERADMIN") return null;

  const revoke = async (id: string) => {
    setRemovingId(id);
    const result = await removeOwnerAction(id);
    setRemovingId(null);
    if (!result.ok) return setLoadError(result.error);
    await refresh();
  };

  const reactivate = async (id: string) => {
    setReactivatingId(id);
    const result = await updateOwnerAction(id, { active: true });
    setReactivatingId(null);
    if (!result.ok) return setLoadError(result.error);
    await refresh();
  };

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight">Application overview</h1>
          <p className="text-[#171717]/70 text-xs mt-1">
            Manage every business-owner login from the single Super Admin panel.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          + Add business owner
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#171717]/70">Total businesses</p>
          <p className="text-3xl font-semibold mt-2">{stats.total}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#171717]/70">Active owners</p>
          <p className="text-3xl font-semibold mt-2">{stats.active}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#171717]/70">Revoked logins</p>
          <p className="text-3xl font-semibold mt-2">{stats.revoked}</p>
        </div>
      </div>

      {loadError && <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p>}
      {owners.length === 0 && !loadError ? (
        <div className="panel">
          <EmptyState
            emoji="🏪"
            title="No businesses yet"
            hint="Create the first business and its owner login."
            action={<button className="btn-primary" onClick={() => setAddOpen(true)}>+ Add business owner</button>}
          />
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Owner</th>
                <th>Email</th>
                <th>Password</th>
                <th>Business</th>
                <th>URL slug</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id} className={owner.active ? undefined : "opacity-70"}>
                  <td><StatusBadge active={owner.active} /></td>
                  <td className="font-semibold">{owner.name}</td>
                  <td className="font-mono text-[13px]">{owner.email}</td>
                  <td className="font-mono text-[13px]">
                    {owner.loginPassword ?? (
                      <span className="text-neutral-400">Not stored — reset to set</span>
                    )}
                  </td>
                  <td>{owner.business.name}</td>
                  <td className="font-mono text-[13px]">/{owner.business.slug ?? "—"}</td>
                  <td className="text-[13px] text-neutral-600">{fmtDate(owner.createdAt)}</td>
                  <td className="text-right whitespace-nowrap">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      <button
                        className="btn-ghost !py-1.5 !px-3 text-xs"
                        onClick={() => setResetOwner(owner)}
                      >
                        Reset password
                      </button>
                      {owner.active ? (
                        <button
                          className="btn-ghost !py-1.5 !px-3 text-xs"
                          disabled={removingId === owner.id}
                          onClick={() => void revoke(owner.id)}
                        >
                          {removingId === owner.id ? "Revoking…" : "Revoke login"}
                        </button>
                      ) : (
                        <button
                          className="btn-ghost !py-1.5 !px-3 text-xs"
                          disabled={reactivatingId === owner.id}
                          onClick={() => void reactivate(owner.id)}
                        >
                          {reactivatingId === owner.id ? "Reactivating…" : "Reactivate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddOwnerModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={refresh} />
      <ResetPasswordModal
        owner={resetOwner}
        onClose={() => setResetOwner(null)}
        onUpdated={refresh}
      />
    </Page>
  );
}

function AddOwnerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({ businessName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setForm({ businessName: "", name: "", email: "", password: "" });
    setError(null);
    onClose();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await createOwnerAction(form);
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onCreated();
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Add business owner">
      {error && <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p>}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {([
          ["businessName", "Business name", "Their shop or factory"],
          ["name", "Owner name", "Owner name"],
          ["email", "Email", "owner@example.com"],
          ["password", "Password", "At least 8 characters"],
        ] as const).map(([key, label, placeholder]) => (
          <div key={key}>
            <label htmlFor={`owner-${key}`}>{label}</label>
            <input
              id={`owner-${key}`}
              type={key === "password" ? "password" : key === "email" ? "email" : "text"}
              value={form[key]}
              placeholder={placeholder}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create owner"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  owner,
  onClose,
  onUpdated,
}: {
  owner: OwnerAccount | null;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!owner) return;
    setPending(true);
    const result = await updateOwnerAction(owner.id, { password });
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onUpdated();
    close();
  };

  return (
    <Modal open={Boolean(owner)} onClose={close} title={`Reset password — ${owner?.name ?? ""}`}>
      {error && <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p>}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="text"
            value={password}
            placeholder="At least 8 characters"
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="text-xs text-neutral-500 mt-2">
            The new password will appear in the owners table for your records.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending || !owner}>
            {pending ? "Saving…" : "Save password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
