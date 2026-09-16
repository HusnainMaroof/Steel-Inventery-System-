import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";

@Controller("payments")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user.businessId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("type") type?: "customer" | "supplier",
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.paymentsService.list(
      user.businessId,
      skip,
      take,
      type,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  /** Payment history for one party — auditable (§10). */
  @Get(":id")
  byId(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.paymentsService.byId(user.businessId, id);
  }
}
