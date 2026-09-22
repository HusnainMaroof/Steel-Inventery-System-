import { Module } from "@nestjs/common";
import { CatalogueCache } from "./catalogue-cache";

/** Tiny provider module so product/warehouse/ledger services share one cache instance. */
@Module({
  providers: [CatalogueCache],
  exports: [CatalogueCache],
})
export class CatalogueCacheModule {}
