import type {
  PlatformOverview,
  ProductTemplateOption,
  SubscriptionPlanOption,
} from "@/app/actions/platform";
import type { OwnerAccount } from "@/app/actions/users";

type AdminSnapshot = {
  owners: OwnerAccount[];
  overview: PlatformOverview | null;
  templates: ProductTemplateOption[];
  subscriptionPlans: SubscriptionPlanOption[];
  loaded: {
    owners: boolean;
    overview: boolean;
    templates: boolean;
    subscriptionPlans: boolean;
  };
};

let snapshot: AdminSnapshot | null = null;

export function readAdminCache(): AdminSnapshot | null {
  return snapshot;
}

type AdminCachePatch = {
  owners?: OwnerAccount[];
  overview?: PlatformOverview | null;
  templates?: ProductTemplateOption[];
  subscriptionPlans?: SubscriptionPlanOption[];
  loaded?: Partial<AdminSnapshot["loaded"]>;
};

export function writeAdminCache(patch: AdminCachePatch) {
  const prev = snapshot;
  snapshot = {
    owners: patch.owners ?? prev?.owners ?? [],
    overview: patch.overview !== undefined ? patch.overview : (prev?.overview ?? null),
    templates: patch.templates ?? prev?.templates ?? [],
    subscriptionPlans: patch.subscriptionPlans ?? prev?.subscriptionPlans ?? [],
    loaded: {
      owners: patch.loaded?.owners === true ? true : (prev?.loaded?.owners ?? false),
      overview: patch.loaded?.overview === true ? true : (prev?.loaded?.overview ?? false),
      templates: patch.loaded?.templates === true ? true : (prev?.loaded?.templates ?? false),
      subscriptionPlans:
        patch.loaded?.subscriptionPlans === true
          ? true
          : (prev?.loaded?.subscriptionPlans ?? false),
    },
  };
}

export function invalidateAdminCache() {
  snapshot = null;
}
