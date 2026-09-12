"use client";

import type { AttributeDef, AttributeOption } from "@/lib/types";

/*
 * Generic dynamic attribute form engine.
 * Renders whatever the configured AttributeDefs say — no product names here:
 *   select       → dropdown of that attribute's options
 *   number       → number input
 *   measurement  → number input with the unit suffix
 *   text         → text input
 *   boolean      → Yes/No toggle (stored as "yes" / "")
 *   date         → date input
 */

export function validateAttributes(defs: AttributeDef[], value: Record<string, string>) {
  const errors: Record<string, string> = {};
  for (const d of defs)
    if (d.active && d.required && !(value[d.key]?.trim()))
      errors[d.key] = `${d.name} is required.`;
  return errors;
}

export function AttributeFields({
  defs,
  value,
  onChange,
  optionsOf,
  requiredError,
}: {
  defs: AttributeDef[];
  value: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  optionsOf?: (defId: string) => AttributeOption[];
  requiredError?: Record<string, string>;
}) {
  const ordered = [...defs]
    .filter((d) => d.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (ordered.length === 0) return null;

  const set = (key: string, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {ordered.map((def) => (
        <div key={def.id}>
          <label htmlFor={`attr-${def.id}`}>
            {def.name}
            {def.required && <span className="text-[#a12b1f]"> *</span>}
          </label>
          {def.type === "select" ? (
            <select
              id={`attr-${def.id}`}
              value={value[def.key] ?? ""}
              onChange={(e) => set(def.key, e.target.value)}
              className="!py-2.5"
            >
              <option value="">{def.required ? "Select…" : "None"}</option>
              {(optionsOf?.(def.id) ?? [])
                .filter((o) => o.active)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
            </select>
          ) : def.type === "boolean" ? (
            <select
              id={`attr-${def.id}`}
              value={value[def.key] === "yes" ? "yes" : ""}
              onChange={(e) => set(def.key, e.target.value)}
              className="!py-2.5"
            >
              <option value="">No</option>
              <option value="yes">Yes</option>
            </select>
          ) : (
            <div className="relative">
              {(def.type === "number" || def.type === "measurement") && (
                <input
                  id={`attr-${def.id}`}
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={value[def.key] ?? ""}
                  onChange={(e) => set(def.key, e.target.value)}
                  className="!py-2.5"
                />
              )}
              {def.type === "measurement" && def.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-400 pointer-events-none">
                  {def.unit}
                </span>
              )}
              {def.type === "text" && (
                <input
                  id={`attr-${def.id}`}
                  type="text"
                  value={value[def.key] ?? ""}
                  onChange={(e) => set(def.key, e.target.value)}
                  className="!py-2.5"
                />
              )}
              {def.type === "date" && (
                <input
                  id={`attr-${def.id}`}
                  type="date"
                  value={value[def.key] ?? ""}
                  onChange={(e) => set(def.key, e.target.value)}
                  className="!py-2.5"
                />
              )}
            </div>
          )}
          {requiredError?.[def.key] && (
            <p className="text-[12px] font-medium text-[#a12b1f] mt-1.5">
              {requiredError[def.key]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
