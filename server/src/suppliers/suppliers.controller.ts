import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";

@Controller("suppliers")
@UseGuards(JwtAuthGuard)
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
  payables(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.suppliersService.payables(user.businessId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.businessId, id, dto);
  }

  @Delete(":id")
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.suppliersService.deactivate(user.businessId, id);
  }
}
