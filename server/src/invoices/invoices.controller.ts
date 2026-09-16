import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { InvoicesService } from "./invoices.service";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";

@Controller("invoices")
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("dueOnly") dueOnly?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.invoicesService.list(
      user.businessId,
      skip,
      take,
      dueOnly === "true",
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Get(":id")
  byId(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.invoicesService.byId(user.businessId, id);
  }
}
