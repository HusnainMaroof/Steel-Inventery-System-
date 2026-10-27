"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listProductTemplatesFullAction,
  type ProductTemplateFull,
} from "@/app/actions/platform";
import { AddCatalogTemplateModal, TemplateCatalogCard } from "@/components/admin/catalog-templates";
import { AdminProductsSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { AdminPageHeader, AdminCard, AdminSectionTitle } from "@/components/admin/admin-ui";
import { EmptyState, Page } from "@/components/ui";
import { invalidateAdminCache } from "@/lib/admin-cache";
import { BUILTIN_TEMPLATE_META } from "@/lib/admin-platform-meta";

type TemplatesFullResult = Awaited<ReturnType<typeof listProductTemplatesFullAction>>;

/**
 * Module-level in-flight dedupe. Next.js dev remounts this page (Strict Mode
 * double-mount) and each fresh instance re-runs its load effect with brand
 * new refs — only module scope survives remounts. `force` bypasses the
 * dedupe for explicit reloads.
 */
let templatesFullInFlight: Promise<TemplatesFullResult> | null = null;

function requestTemplatesFull(force = false): Promise<TemplatesFullResult> {
  if (force) templatesFullInFlight = null;
  if (!templatesFullInFlight) {
    templatesFullInFlight = listProductTemplatesFullAction().finally(() => {
      templatesFullInFlight = null;
    });
  }
  return templatesFullInFlight;
}

export default function AdminProductsPage() {
  const { user, ready } = useAuth();
  const [templates, setTemplates] = useState<ProductTemplateFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setLoadError(null);
    const result = await requestTemplatesFull(force);
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setTemplates(result.templates);
    setExpandedId((current) => current ?? result.templates[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!ready || user?.role !== "SUPERADMIN") return;
    void load();
  }, [ready, user?.role, load]);

  const reload = async () => {
    invalidateAdminCache();
    await load(true);
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || loading) return <AdminProductsSkeleton />;

  const builtinIds = new Set(Object.keys(BUILTIN_TEMPLATE_META));
  const builtIn = templates.filter((t) => builtinIds.has(t.id));
  const custom = templates.filter((t) => !builtinIds.has(t.id));

  return (
    <Page>
      <AdminPageHeader
        title="Catalog"
        meta="Product templates for new businesses."
        actions={
          <button className="btn-primary w-full sm:w-auto" onClick={() => setAddOpen(true)}>
            New template
          </button>
        }
      />

      {loadError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p> : null}

      {!loadError && templates.length === 0 ? (
        <AdminCard>
          <EmptyState
            title="No templates"
            hint="Create a product template with attributes and dropdown options."
            action={<button className="btn-primary" onClick={() => setAddOpen(true)}>New template</button>}
          />
        </AdminCard>
      ) : (
        <div className="space-y-8">
          {builtIn.length > 0 ? (
            <section>
              <AdminSectionTitle title="Built-in trade types" />
              <div className="space-y-3">
                {builtIn.map((template) => (
                  <TemplateCatalogCard
                    key={template.id}
                    template={template}
                    expanded={expandedId === template.id}
                    onToggle={() => setExpandedId((current) => (current === template.id ? null : template.id))}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {custom.length > 0 ? (
            <section>
              <AdminSectionTitle title="Custom templates" />
              <div className="space-y-3">
                {custom.map((template) => (
                  <TemplateCatalogCard
                    key={template.id}
                    template={template}
                    expanded={expandedId === template.id}
                    onToggle={() => setExpandedId((current) => (current === template.id ? null : template.id))}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <AddCatalogTemplateModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
    </Page>
  );
}
