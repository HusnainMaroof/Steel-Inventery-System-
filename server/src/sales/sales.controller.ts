import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.businessId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("customerId") customerId?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.salesService.list(
      user.businessId,
      skip,
      take,
      customerId,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Get(":id")
  byId(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.salesService.byId(user.businessId, id);
  }

  /** Cascade: stock back via reversal ledger rows, invoice + allocations removed. */
  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.salesService.remove(user.businessId, id);
  }
}
