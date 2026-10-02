import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequireStaffPage } from "../common/decorators/require-staff-page.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffAccessGuard } from "../common/guards/staff-access.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { sanitizePlanPages } from "../common/panel-access";
import { sanitizeAccess, type StaffPage } from "../common/staff-access";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";

function assertCanRecordPayment(user: AuthUser, type: CreatePaymentDto["type"]) {
  if (user.role === "SUPERADMIN") return;

  const needed: StaffPage = type === "CUSTOMER" ? "sales" : "purchases";
  const plan = new Set(sanitizePlanPages(user.planPages));
  if (!plan.has("payments") && !plan.has(needed)) {
    throw new ForbiddenException("This feature is not included in your subscription plan");
  }

  if (user.role === "ADMIN") return;
  if (user.role !== "SUBADMIN") {
    throw new ForbiddenException("Your role cannot perform this action");
  }

  const access = new Set(sanitizeAccess(user.access));
  if (!access.has("payments") && !access.has(needed)) {
    throw new ForbiddenException("You do not have access to this feature");
  }
}

@Controller("payments")
@UseGuards(JwtAuthGuard, StaffAccessGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequireStaffPage("payments", "sales", "purchases")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    assertCanRecordPayment(user, dto.type);
    return this.paymentsService.create(user.businessId, dto, user.sub);
  }

  @Get()
  @RequireStaffPage("payments")
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
  @RequireStaffPage("payments")
  byId(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.paymentsService.byId(user.businessId, id);
  }
}
