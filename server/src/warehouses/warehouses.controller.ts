import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireStaffPage } from "../common/decorators/require-staff-page.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffAccessGuard } from "../common/guards/staff-access.guard";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";
import {
  CreateLocationDto,
  CreateWarehouseDto,
  UpdateLocationDto,
  UpdateWarehouseDto,
} from "./warehouse.dto";
import { WarehousesService } from "./warehouses.service";

@Controller("warehouses")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
@RequireStaffPage("inventory")
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.warehouses.list(user.businessId, skip, take);
    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(user.businessId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(user.businessId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.warehouses.remove(user.businessId, id);
  }

  @Post(":id/locations")
  createLocation(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string, @Body() dto: CreateLocationDto) {
    return this.warehouses.createLocation(user.businessId, id, dto);
  }

  @Patch("locations/:id")
  updateLocation(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.warehouses.updateLocation(user.businessId, id, dto);
  }

  @Delete("locations/:id")
  removeLocation(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.warehouses.removeLocation(user.businessId, id);
  }
}
