import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CatalogueCacheModule } from "../ledger/catalogue-cache.module";
import { TemplateProvisionService } from "../catalog/template-provision.service";
import { SubscriptionModule } from "../subscription/subscription.module";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [PrismaModule, CatalogueCacheModule, SubscriptionModule],
  controllers: [PlatformController],
  providers: [PlatformService, TemplateProvisionService],
  exports: [TemplateProvisionService],
})
export class PlatformModule {}
