import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { InventoryService } from "./inventory.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";

@Controller("inventory")
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /** Derived stock per product — never stored, always computed from the ledger. */
  @Get("stock")
  stock(@CurrentUser() user: AuthUser) {
    return this.inventoryService.stock(user.businessId);
  }

  @Get("variants")
  variants(@CurrentUser() user: AuthUser) {
    return this.inventoryService.stockByVariant(user.businessId);
  }

  @Get("lots")
  lots(@CurrentUser() user: AuthUser) {
    return this.inventoryService.lots(user.businessId);
  }

  /** Movement history — answers "why is stock this quantity?" (§27). */
  @Get("movements")
  movements(
    @CurrentUser() user: AuthUser,
    @Query("productId") productId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.inventoryService.movements(user.businessId, { productId, from, to });
  }

  /**
   * The only way stock changes outside purchase/sale — and even this is a
   * ledgered ADJUSTMENT transaction, never an arbitrary quantity edit.
   */
  @Post("adjustments")
  adjust(@CurrentUser() user: AuthUser, @Body() dto: AdjustInventoryDto) {
    return this.inventoryService.adjust(user.businessId, dto);
  }
}
