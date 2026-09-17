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
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { PurchasesService } from "./purchases.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";

@Controller("purchases")
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(user.businessId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query("supplierId") supplierId?: string,
  ) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.purchasesService.list(
      user.businessId,
      skip,
      take,
      supplierId,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Get(":id")
  byId(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.purchasesService.byId(user.businessId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    return this.purchasesService.update(user.businessId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.purchasesService.remove(user.businessId, id);
  }
}
