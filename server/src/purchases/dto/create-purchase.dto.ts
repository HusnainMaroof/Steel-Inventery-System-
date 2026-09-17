import {
  IsArray,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";

export class CreatePurchaseLineDto {
  @IsCuid()
  productId: string;

  @IsOptional()
  @IsCuid()
  variantId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  item: string;

  /** Attribute key → value snapshot at entry — history never rewrites. */
  @IsOptional()
  @IsObject()
  attributeSnapshot?: Record<string, string>;

  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  unit: string;

  @IsNumber()
  @Min(0)
  rate: number;

  /** Planned selling price recorded at purchase time. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellRate?: number;

  @IsOptional() @IsString() @MaxLength(80) productName?: string;
  @IsOptional() @IsString() @MaxLength(80) spec?: string;
  @IsOptional() @IsString() @MaxLength(80) quality?: string;
  @IsOptional() @IsString() @MaxLength(80) lotNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) heatNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) batchNumber?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() locationId?: string;
}

export class CreatePurchaseDto {
  @IsDateString()
  date: string;

  @IsCuid()
  supplierId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseLineDto)
  lines: CreatePurchaseLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transport?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loading?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherCost?: number;

  /** Amount paid to the mill now — can never exceed the goods total. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  paid?: number;
}
