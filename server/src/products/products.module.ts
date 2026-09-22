import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { PrismaModule } from "../prisma/prisma.module";
import { CatalogueCacheModule } from "../ledger/catalogue-cache.module";

@Module({
  imports: [PrismaModule, CatalogueCacheModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
