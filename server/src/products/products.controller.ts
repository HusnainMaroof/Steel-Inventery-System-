import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";

@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.businessId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.productsService.list(user.businessId);
  }

  @Get(":id")
  byId(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.productsService.byId(user.businessId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.businessId, id, dto);
  }

  /** Deactivate, never hard-delete (catalogue history is immutable). */
  @Delete(":id")
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
  ) {
    return this.productsService.deactivate(user.businessId, id);
  }

  @Post(":id/categories")
  createCategory(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.productsService.createCategory(user.businessId, id, dto);
  }

  @Post(":id/variants")
  createVariant(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productsService.createVariant(user.businessId, id, dto);
  }
}
