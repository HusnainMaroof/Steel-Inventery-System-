import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { RequireStaffPage } from "../common/decorators/require-staff-page.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffAccessGuard } from "../common/guards/staff-access.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { InventoryService } from "./inventory.service";
import { AdjustInventoryDto } from "./dto/adjust-inventory.dto";

@Controller("inventory")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
@RequireStaffPage("inventory")
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
  async lots(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, totalPurchases] = await Promise.all([
      this.inventoryService.lots(user.businessId, skip, take),
      this.inventoryService.lotsCount(user.businessId),
    ]);
    return paginate(items, totalPurchases, pagination.page, pagination.limit);
  }

  /** Movement history — answers "why is stock this quantity?" (§27). */
  @Get("movements")
  async movements(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("productId") productId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.inventoryService.movements(
      user.businessId,
      skip,
      take,
      { productId, from, to },
    );
    return paginate(items, total, pagination.page, pagination.limit);
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
