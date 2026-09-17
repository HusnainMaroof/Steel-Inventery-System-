import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { LedgerService } from "./ledger.service";

@Controller("ledger")
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get("bootstrap")
  async bootstrap(@CurrentUser() user: AuthUser) {
    return { data: await this.ledgerService.bootstrap(user.businessId, user.role) };
  }

}
