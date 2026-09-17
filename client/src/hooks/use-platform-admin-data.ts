"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPlatformOverviewAction,
  listProductTemplatesAction,
  listSubscriptionPlansAction,
  type PlatformOverview,
  type ProductTemplateOption,
  type SubscriptionPlanOption,
} from "@/app/actions/platform";
import { listOwnersAction, type OwnerAccount } from "@/app/actions/users";
import { invalidateAdminCache, readAdminCache, writeAdminCache } from "@/lib/admin-cache";

type LoadOpts = {
  owners?: boolean;
  overview?: boolean;
  templates?: boolean;
  subscriptionPlans?: boolean;
};

function cacheReady(needs: LoadOpts, hit: NonNullable<ReturnType<typeof readAdminCache>>) {
  if (needs.owners && !hit.loaded.owners) return false;
  if (needs.overview && !hit.loaded.overview) return false;
  if (needs.templates && !hit.loaded.templates) return false;
  if (needs.subscriptionPlans && !hit.loaded.subscriptionPlans) return false;
  return true;
}

export function usePlatformAdminData(
  enabled: boolean,
  needs: LoadOpts = {
    owners: true,
    overview: true,
    templates: true,
    subscriptionPlans: true,
  },
) {
  const initial = readAdminCache();
  const [owners, setOwners] = useState<OwnerAccount[]>(initial?.owners ?? []);
  const [overview, setOverview] = useState<PlatformOverview | null>(initial?.overview ?? null);
  const [templates, setTemplates] = useState<ProductTemplateOption[]>(initial?.templates ?? []);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanOption[]>(
    initial?.subscriptionPlans ?? [],
  );
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
        if (needs.subscriptionPlans) setSubscriptionPlans(hit.subscriptionPlans);
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
        let nextPlans: SubscriptionPlanOption[] | undefined;
        const loaded = {
          owners: false,
          overview: false,
          templates: false,
          subscriptionPlans: false,
        };

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
        if (needs.subscriptionPlans) {
          tasks.push(
            listSubscriptionPlansAction(true).then((result) => {
              if (!result.ok) throw new Error(result.error);
              nextPlans = result.plans;
              loaded.subscriptionPlans = true;
              setSubscriptionPlans(result.plans);
            }),
          );
        }

        await Promise.all(tasks);
        writeAdminCache({
          ...(nextOwners !== undefined ? { owners: nextOwners } : {}),
          ...(nextOverview !== undefined ? { overview: nextOverview } : {}),
          ...(nextTemplates !== undefined ? { templates: nextTemplates } : {}),
          ...(nextPlans !== undefined ? { subscriptionPlans: nextPlans } : {}),
          loaded: {
            ...(loaded.owners ? { owners: true } : {}),
            ...(loaded.overview ? { overview: true } : {}),
            ...(loaded.templates ? { templates: true } : {}),
            ...(loaded.subscriptionPlans ? { subscriptionPlans: true } : {}),
          },
        });
      } catch (reason) {
        setLoadError(reason instanceof Error ? reason.message : "Could not load platform data");
      } finally {
        setLoading(false);
      }
    },
    [
      enabled,
      needs.owners,
      needs.overview,
      needs.templates,
      needs.subscriptionPlans,
    ],
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
    subscriptionPlans,
    loading,
    loadError,
    refresh: () => refresh(true),
    invalidate,
  };
}
