import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { SaveLedgerDto } from "./dto/save-ledger.dto";
import { LedgerService } from "./ledger.service";

@Controller("settings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class SettingsController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    if (user.role === "SUPERADMIN") return { data: {} };
    return this.ledger.getPreferences(user.businessId);
  }

  @Put()
  update(@CurrentUser() user: AuthUser, @Body() dto: SaveLedgerDto) {
    if (user.role === "SUPERADMIN") {
      return { data: {} };
    }
    return this.ledger.savePreferences(
      user.businessId,
      dto.data as Record<string, unknown>,
      user.sub,
    );
  }
}
