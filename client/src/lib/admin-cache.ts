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

/** Same order as GET /owners: active first, then oldest first. */
function ownerOrder(a: OwnerAccount, b: OwnerAccount) {
  if (a.active !== b.active) return a.active ? -1 : 1;
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

/**
 * Puts a just-created owner into the cached list without a refetch. Templates and
 * plans did not change, so they stay. The overview counts did change, so the
 * overview slice is dropped and reloads when that page opens.
 */
export function addOwnerToAdminCache(owner: OwnerAccount): OwnerAccount[] {
  const owners = [...(snapshot?.owners ?? []).filter((item) => item.id !== owner.id), owner].sort(
    ownerOrder,
  );
  writeAdminCache({ owners });
  if (snapshot) {
    snapshot = { ...snapshot, overview: null, loaded: { ...snapshot.loaded, overview: false } };
  }
  return owners;
}
