import { Injectable } from "@nestjs/common";

/**
 * In-process cache for the catalogue portion of the bootstrap payload,
 * keyed by businessId. NO TTL by design — every catalogue/settings write
 * calls invalidate(businessId) synchronously in the same service method,
 * so a renamed product is visible on the very next bootstrap.
 *
 * Single-instance only. If the API ever runs multiple instances behind a
 * load balancer, this is the cache to migrate to a shared store
 * (Redis or similar) — bootstrap is read far more often than catalogue
 * data is written.
 */
const MAX_CACHED_BUSINESSES = 500;

export interface BootstrapCatalogue {
  products: unknown[];
  productItems: unknown[];
  categories: unknown[];
  /** Raw rows — nested options/locations are stripped per request. */
  attributeDefs: Array<{ options: unknown[] } & Record<string, unknown>>;
  variants: unknown[];
  warehouses: Array<{ locations: unknown[] } & Record<string, unknown>>;
  settings: Record<string, unknown>;
}

@Injectable()
export class CatalogueCache {
  private readonly entries = new Map<string, BootstrapCatalogue>();

  get(businessId: string): BootstrapCatalogue | null {
    return this.entries.get(businessId) ?? null;
  }

  set(businessId: string, data: BootstrapCatalogue): void {
    if (!this.entries.has(businessId) && this.entries.size >= MAX_CACHED_BUSINESSES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(businessId, data);
  }

  /** Called after every Product/Category/Attribute/Option/Variant/Warehouse/Location/settings write. */
  invalidate(businessId: string): void {
    this.entries.delete(businessId);
  }
}
