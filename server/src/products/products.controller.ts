import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import {
  CreateAttributeDto,
  CreateOptionDto,
  ReorderDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateOptionDto,
  UpdateVariantDto,
} from "./dto/catalogue.dto";

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

  @Delete(":id")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
  ) {
    return this.productsService.remove(user.businessId, id);
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

  @Patch("categories/:id")
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.productsService.updateCategory(user.businessId, id, dto);
  }

  @Delete("categories/:id")
  removeCategory(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.productsService.removeCategory(user.businessId, id);
  }

  @Post(":id/attributes")
  createAttribute(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: CreateAttributeDto,
  ) {
    return this.productsService.createAttribute(user.businessId, id, dto);
  }

  @Put(":id/attributes/order")
  reorderAttributes(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: ReorderDto,
  ) {
    return this.productsService.reorderAttributes(user.businessId, id, dto);
  }

  @Patch("attributes/:id")
  updateAttribute(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateAttributeDto,
  ) {
    return this.productsService.updateAttribute(user.businessId, id, dto);
  }

  @Delete("attributes/:id")
  removeAttribute(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.productsService.removeAttribute(user.businessId, id);
  }

  @Post("attributes/:id/options")
  createOption(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: CreateOptionDto,
  ) {
    return this.productsService.createOption(user.businessId, id, dto);
  }

  @Put("attributes/:id/options/order")
  reorderOptions(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: ReorderDto,
  ) {
    return this.productsService.reorderOptions(user.businessId, id, dto);
  }

  @Patch("options/:id")
  updateOption(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateOptionDto,
  ) {
    return this.productsService.updateOption(user.businessId, id, dto);
  }

  @Delete("options/:id")
  removeOption(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.productsService.removeOption(user.businessId, id);
  }

  @Patch("variants/:id")
  updateVariant(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(user.businessId, id, dto);
  }

  @Delete("variants/:id")
  removeVariant(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.productsService.removeVariant(user.businessId, id);
  }
}
