"use client";

import { useEffect, useState } from "react";
import {
  createStaffAction,
  listStaffAction,
  removeStaffAction,
  updateStaffAction,
  type StaffAccount,
} from "@/app/actions/users";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/lib/auth-types";
import {
  accessSummary,
  allStaffPages,
  pageLabel,
  STAFF_TITLE_PRESETS,
  type StaffPage,
} from "@/lib/staff-access";
import { EmptyState, Modal, Page } from "@/components/ui";

export default function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffAccount | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refresh = async () => {
    const result = await listStaffAction();
    if (!result.ok) return setLoadError(result.error);
    setStaff(result.staff);
    setLoadError(null);
  };

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    void refresh();
  }, [user?.role]);

  if (user?.role !== "ADMIN") return null;

  const revoke = async (id: string) => {
    setRemovingId(id);
    const result = await removeStaffAction(id);
    setRemovingId(null);
    if (!result.ok) return setLoadError(result.error);
    await refresh();
  };

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight">Staff</h1>
          <p className="text-[#171717]/70 text-xs mt-1">
            Add managers and staff — each login sees only the pages you allow.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          + Add staff member
        </button>
      </div>

      {loadError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p> : null}

      {staff.length === 0 && !loadError ? (
        <div className="panel">
          <EmptyState
            emoji="👥"
            title="No staff yet"
            hint="Create a sales manager, store keeper, or other role with limited access."
            action={<button className="btn-primary" onClick={() => setAddOpen(true)}>+ Add staff member</button>}
          />
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Can open</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td className="font-semibold">{member.name}</td>
                  <td className="font-mono text-[13px]">{member.email}</td>
                  <td>{roleLabel(member.role, member.title)}</td>
                  <td className="text-[13px] text-[#171717]/80">{accessSummary(member.access)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      className="btn-ghost !py-1.5 !px-3 text-xs mr-1"
                      onClick={() => setEditTarget(member)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-ghost !py-1.5 !px-3 text-xs"
                      disabled={removingId === member.id}
                      onClick={() => void revoke(member.id)}
                    >
                      {removingId === member.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StaffModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <StaffModal
        open={!!editTarget}
        member={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={async () => {
          await refresh();
          setEditTarget(null);
        }}
      />
    </Page>
  );
}

function StaffModal({
  open,
  member,
  onClose,
  onSaved,
}: {
  open: boolean;
  member?: StaffAccount;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const editing = !!member;
  const [form, setForm] = useState({
    name: member?.name ?? "",
    email: member?.email ?? "",
    password: "",
    title: member?.title ?? STAFF_TITLE_PRESETS[0],
    access: member?.access ?? (["sales"] as StaffPage[]),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: member?.name ?? "",
      email: member?.email ?? "",
      password: "",
      title: member?.title ?? STAFF_TITLE_PRESETS[0],
      access: member?.access ?? (["sales"] as StaffPage[]),
    });
    setError(null);
  }, [open, member]);

  const close = () => {
    setError(null);
    onClose();
  };

  const togglePage = (page: StaffPage) => {
    setForm((current) => ({
      ...current,
      access: current.access.includes(page)
        ? current.access.filter((item) => item !== page)
        : [...current.access, page],
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = editing
      ? await updateStaffAction(member!.id, {
          name: form.name,
          title: form.title,
          access: form.access,
          password: form.password || undefined,
        })
      : await createStaffAction(form);
    setPending(false);
    if (!result.ok) return setError(result.error);
    await onSaved();
    close();
  };

  return (
    <Modal open={open} onClose={close} title={editing ? "Edit staff member" : "Add staff member"}>
      {error ? <p role="alert" className="text-sm text-[#a12b1f] mb-3">{error}</p> : null}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label htmlFor="staff-name">Name</label>
          <input
            id="staff-name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        {!editing ? (
          <div>
            <label htmlFor="staff-email">Email</label>
            <input
              id="staff-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="staff-title">Job title</label>
          <input
            id="staff-title"
            list="staff-title-presets"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
          <datalist id="staff-title-presets">
            {STAFF_TITLE_PRESETS.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
        </div>
        {!editing ? (
          <div>
            <label htmlFor="staff-password">Password</label>
            <input
              id="staff-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="staff-password-reset">New password (optional)</label>
            <input
              id="staff-password-reset"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
          </div>
        )}
        <fieldset>
          <legend className="text-[13px] font-medium text-[#171717] mb-2">Pages they can open</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allStaffPages().map((page) => (
              <label key={page} className="flex items-center gap-2 text-[13px] !mb-0 !normal-case">
                <input
                  type="checkbox"
                  checked={form.access.includes(page)}
                  onChange={() => togglePage(page)}
                />
                {pageLabel(page)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create staff login"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
