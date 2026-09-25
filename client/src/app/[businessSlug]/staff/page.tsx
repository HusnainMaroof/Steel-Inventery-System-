"use client";

import { useEffect, useMemo, useState } from "react";
import { userFacingError } from "@/lib/user-error";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { StaffMember } from "@/lib/types";
import {
  accessSummary,
  allStaffPages,
  pageLabel,
  STAFF_TITLE_PRESETS,
  type StaffPage,
} from "@/lib/staff-access";
import { BusyButton, EmptyState, Modal, Page, PageTitle } from "@/components/ui";

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function StaffPage() {
  const { user } = useAuth();
  const { staff, removeStaff } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  if (user?.role !== "ADMIN") return null;

  const revoke = async (id: string) => {
    setRemovingId(id);
    setLoadError(null);
    try {
      await removeStaff(id);
    } catch (reason) {
      setLoadError(userFacingError(reason, "Could not remove staff member"));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <PageTitle
          title="Staff"
          sub="Give each person their own login and choose which parts of the app they can use."
        />
        <button type="button" className="btn-primary shrink-0" onClick={() => setAddOpen(true)}>
          + Add staff member
        </button>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">
          {loadError}
        </p>
      ) : null}

      {staff.length === 0 ? (
        <div className="panel p-8">
          <EmptyState
            emoji="👥"
            title="No staff yet"
            hint="Create a sales manager, store keeper, or accountant with limited access."
            action={
              <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
                + Add staff member
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className="panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#171717] truncate">{member.name}</p>
                <p className="text-[13px] text-neutral-600 truncate mt-0.5">{member.email}</p>
                <p className="text-[12px] text-neutral-500 mt-1">
                  {member.title ?? "Staff"} · {accessSummary(member.access)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="btn-ghost !py-2 !px-3 !text-xs"
                  onClick={() => setEditTarget(member)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-2 !px-3 !text-xs text-[#a12b1f] hover:text-[#a12b1f]"
                  disabled={removingId === member.id}
                  onClick={() => void revoke(member.id)}
                >
                  {removingId === member.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <StaffModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => setAddOpen(false)} />
      <StaffModal
        open={!!editTarget}
        member={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={() => setEditTarget(null)}
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
  member?: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { addStaff, updateStaff } = useStore();
  const editing = !!member;
  const [form, setForm] = useState({
    name: member?.name ?? "",
    email: member?.email ?? "",
    password: "",
    title: member?.title ?? STAFF_TITLE_PRESETS[0],
    access: member?.access ?? (["dashboard", "sales"] as StaffPage[]),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const accessPages = useMemo(() => allStaffPages(), []);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: member?.name ?? "",
      email: member?.email ?? "",
      password: "",
      title: member?.title ?? STAFF_TITLE_PRESETS[0],
      access: member?.access?.length ? member.access : (["dashboard", "sales"] as StaffPage[]),
    });
    setShowPassword(false);
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
    if (!form.access.length) {
      setError("Select at least one page they can access.");
      return;
    }
    if (!editing && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (editing) {
        await updateStaff(member!.id, {
          name: form.name,
          title: form.title,
          access: form.access,
          password: form.password || undefined,
        });
      } else {
        await addStaff({
          name: form.name,
          email: form.email,
          password: form.password,
          title: form.title,
          access: form.access,
        });
      }
      onSaved();
      close();
    } catch (reason) {
      setError(userFacingError(reason, "Could not save staff member"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? "Edit staff member" : "Add staff member"}
      size="lg"
    >
      {error ? (
        <p role="alert" className="text-sm text-[#a12b1f] mb-4">
          {error}
        </p>
      ) : null}
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="staff-name">Full name</label>
            <input
              id="staff-name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Ahmed Khan"
            />
          </div>
          {!editing ? (
            <div>
              <label htmlFor="staff-email">Login email</label>
              <input
                id="staff-email"
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="staff@yourbusiness.com"
              />
            </div>
          ) : (
            <div>
              <label>Login email</label>
              <p className="text-[13px] text-neutral-600 py-2.5 px-3 border border-neutral-200 rounded-lg bg-neutral-50">
                {member?.email}
              </p>
            </div>
          )}
        </div>

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

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
            <label htmlFor="staff-password" className="!mb-0">
              {editing ? "New password (optional)" : "Password"}
            </label>
            {!editing ? (
              <button
                type="button"
                className="text-[11px] font-medium text-neutral-600 underline underline-offset-2 hover:text-black"
                onClick={() => {
                  setForm((c) => ({ ...c, password: generatePassword() }));
                  setShowPassword(true);
                }}
              >
                Generate secure password
              </button>
            ) : null}
          </div>
          <div className="relative">
            <input
              id="staff-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={editing ? "Leave blank to keep current" : "At least 8 characters"}
              className="!pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-black rounded-md"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M3 3l18 18M10.5 10.677a2.25 2.25 0 102.25 2.25M6.4 6.4C4.2 7.9 2.7 9.9 2 12c1.5 4.5 6 7.5 10 7.5 1.6 0 3.1-.4 4.5-1M9.9 4.2A10.8 10.8 0 0112 4c4 0 8.5 3 10 7.5-.6 1.8-1.7 3.4-3 4.5" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <fieldset className="border-0 p-0 m-0">
          <legend className="text-[13px] font-semibold text-[#171717] mb-1">Pages they can access</legend>
          <p className="text-[12px] text-neutral-500 mb-3">
            They only see these sections in the menu. Catalogue data loads for the pages you enable.
          </p>
          <div className="flex flex-wrap gap-2">
            {accessPages.map((page) => {
              const on = form.access.includes(page);
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => togglePage(page)}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                    on
                      ? "bg-[#171717] text-white border-[#171717]"
                      : "bg-white text-[#171717] border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {pageLabel(page)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100">
          <button type="button" className="btn-ghost" onClick={close}>
            Cancel
          </button>
          <BusyButton type="submit" loading={pending}>
            {editing ? "Save changes" : "Create login"}
          </BusyButton>
        </div>
      </form>
    </Modal>
  );
}
