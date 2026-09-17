import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ProductsModule } from "../products/products.module";
import { TemplateProvisionService } from "../catalog/template-provision.service";
import { SubscriptionModule } from "../subscription/subscription.module";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [PrismaModule, ProductsModule, SubscriptionModule],
  controllers: [PlatformController],
  providers: [PlatformService, TemplateProvisionService],
  exports: [TemplateProvisionService],
})
export class PlatformModule {}
