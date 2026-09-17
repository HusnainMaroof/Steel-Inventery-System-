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
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";

@Controller("customers")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
@RequireStaffPage("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.businessId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("search") search?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.customersService.list(
      user.businessId,
      skip,
      take,
      search,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  /** Ledger view — answers "why is this balance this amount?" (§27). */
  @Get(":id/ledger")
  async ledger(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const { rows, totalDue, total } = await this.customersService.ledger(
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
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.businessId, id, dto);
  }

  @Delete(":id")
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
  ) {
    return this.customersService.deactivate(user.businessId, id);
  }
}
