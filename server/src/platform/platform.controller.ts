import { Controller, Get, UseGuards } from "@nestjs/common";
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
}
