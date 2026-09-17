"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPlatformOverviewAction,
  listProductTemplatesAction,
  type PlatformOverview,
  type ProductTemplateOption,
} from "@/app/actions/platform";
import { listOwnersAction, type OwnerAccount } from "@/app/actions/users";
import { invalidateAdminCache, readAdminCache, writeAdminCache } from "@/lib/admin-cache";

type LoadOpts = { owners?: boolean; overview?: boolean; templates?: boolean };

function cacheReady(needs: LoadOpts, hit: NonNullable<ReturnType<typeof readAdminCache>>) {
  if (needs.owners && !hit.loaded.owners) return false;
  if (needs.overview && !hit.loaded.overview) return false;
  if (needs.templates && !hit.loaded.templates) return false;
  return true;
}

export function usePlatformAdminData(
  enabled: boolean,
  needs: LoadOpts = { owners: true, overview: true, templates: true },
) {
  const initial = readAdminCache();
  const [owners, setOwners] = useState<OwnerAccount[]>(initial?.owners ?? []);
  const [overview, setOverview] = useState<PlatformOverview | null>(initial?.overview ?? null);
  const [templates, setTemplates] = useState<ProductTemplateOption[]>(initial?.templates ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => {
    if (!enabled) return false;
    return !(initial && cacheReady(needs, initial));
  });
  const loadedRef = useRef(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;

      const hit = !force ? readAdminCache() : null;
      if (hit && cacheReady(needs, hit)) {
        if (needs.owners) setOwners(hit.owners);
        if (needs.overview) setOverview(hit.overview);
        if (needs.templates) setTemplates(hit.templates);
        setLoadError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const tasks: Promise<void>[] = [];
        let nextOwners: OwnerAccount[] | undefined;
        let nextOverview: PlatformOverview | null | undefined;
        let nextTemplates: ProductTemplateOption[] | undefined;
        const loaded = { owners: false, overview: false, templates: false };

        if (needs.owners) {
          tasks.push(
            listOwnersAction().then((result) => {
              if (!result.ok) throw new Error(result.error);
              nextOwners = result.owners;
              loaded.owners = true;
              setOwners(result.owners);
            }),
          );
        }
        if (needs.overview) {
          tasks.push(
            getPlatformOverviewAction().then((result) => {
              if (!result.ok) throw new Error(result.error);
              nextOverview = result.overview;
              loaded.overview = true;
              setOverview(result.overview);
            }),
          );
        }
        if (needs.templates) {
          tasks.push(
            listProductTemplatesAction().then((result) => {
              if (!result.ok) throw new Error(result.error);
              nextTemplates = result.templates;
              loaded.templates = true;
              setTemplates(result.templates);
            }),
          );
        }

        await Promise.all(tasks);
        writeAdminCache({
          ...(nextOwners !== undefined ? { owners: nextOwners } : {}),
          ...(nextOverview !== undefined ? { overview: nextOverview } : {}),
          ...(nextTemplates !== undefined ? { templates: nextTemplates } : {}),
          loaded: {
            ...(loaded.owners ? { owners: true } : {}),
            ...(loaded.overview ? { overview: true } : {}),
            ...(loaded.templates ? { templates: true } : {}),
          },
        });
      } catch (reason) {
        setLoadError(reason instanceof Error ? reason.message : "Could not load platform data");
      } finally {
        setLoading(false);
      }
    },
    [enabled, needs.owners, needs.overview, needs.templates],
  );

  const invalidate = useCallback(() => {
    invalidateAdminCache();
  }, []);

  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    loadedRef.current = true;
    void refresh();
  }, [enabled, refresh]);

  return {
    owners,
    overview,
    templates,
    loading,
    loadError,
    refresh: () => refresh(true),
    invalidate,
  };
}
