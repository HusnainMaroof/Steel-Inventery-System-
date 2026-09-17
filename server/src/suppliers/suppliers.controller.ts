import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequireStaffPage } from "../common/decorators/require-staff-page.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffAccessGuard } from "../common/guards/staff-access.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";

@Controller("suppliers")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
@RequireStaffPage("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user.businessId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("search") search?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.suppliersService.list(
      user.businessId,
      skip,
      take,
      search,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  /** Payable history — purchases with their remaining due (§27). */
  @Get(":id/payables")
  async payables(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const { rows, totalDue, total } = await this.suppliersService.payables(
      user.businessId,
      id,
      skip,
      take,
    );
    return { ...paginate(rows, total, pagination.page, pagination.limit), totalDue };
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.businessId, id, dto);
  }

  @Delete(":id")
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
  ) {
    return this.suppliersService.deactivate(user.businessId, id);
  }
}
