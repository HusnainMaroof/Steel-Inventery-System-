"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listProductTemplatesFullAction,
  type ProductTemplateFull,
} from "@/app/actions/platform";
import { AddCatalogTemplateModal, TemplateCatalogCard } from "@/components/admin/catalog-templates";
import { AdminProductsSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { EmptyState, Page } from "@/components/ui";
import { invalidateAdminCache } from "@/lib/admin-cache";

export default function AdminProductsPage() {
  const { user, ready } = useAuth();
  const [templates, setTemplates] = useState<ProductTemplateFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await listProductTemplatesFullAction();
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
    await load();
  };

  if (ready && user?.role !== "SUPERADMIN") return null;
  if (!ready || loading) return <AdminProductsSkeleton />;

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl tracking-tight font-semibold">Product templates</h1>
          <p className="text-[#171717]/70 text-xs mt-1">
            Catalogue blueprints for new businesses — steel, cement, wire, or your own custom variants.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          + New template
        </button>
      </div>

      {loadError ? <p role="alert" className="text-sm text-[#a12b1f] mb-4">{loadError}</p> : null}

      {!loadError && templates.length === 0 ? (
        <div className="panel">
          <EmptyState
            emoji="📦"
            title="No templates"
            hint="Create a product template with attributes and dropdown options."
            action={<button className="btn-primary" onClick={() => setAddOpen(true)}>+ New template</button>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <TemplateCatalogCard
              key={template.id}
              template={template}
              expanded={expandedId === template.id}
              onToggle={() => setExpandedId((current) => (current === template.id ? null : template.id))}
            />
          ))}
        </div>
      )}

      <AddCatalogTemplateModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
    </Page>
  );
}
