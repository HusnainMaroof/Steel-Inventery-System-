import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CreateSubscriptionPlanDto } from "../subscription/dto/create-subscription-plan.dto";
import { UpdateSubscriptionPlanDto } from "../subscription/dto/update-subscription-plan.dto";
import { CreateCatalogTemplateDto } from "./dto/create-catalog-template.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPERADMIN")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("overview")
  overview() {
    return this.platform.overview();
  }

  @Get("templates")
  templates() {
    return this.platform.listProductTemplates();
  }

  @Get("templates/full")
  templatesFull() {
    return this.platform.listProductTemplatesFull();
  }

  @Post("templates")
  createTemplate(@Body() dto: CreateCatalogTemplateDto) {
    return this.platform.createCatalogTemplate(dto);
  }

  @Get("subscription-plans")
  subscriptionPlans(@Query("all") all?: string) {
    return this.platform.listSubscriptionPlans(all === "1" || all === "true");
  }

  @Post("subscription-plans")
  createSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.platform.createSubscriptionPlan(dto);
  }

  @Patch("subscription-plans/:id")
  updateSubscriptionPlan(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.platform.updateSubscriptionPlan(id, dto);
  }
}
