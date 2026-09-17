import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";
import { LIMITS } from "../../common/security/limits";

export class CreateSaleLineDto {
  @IsCuid()
  productId: string;

  @IsOptional()
  @IsCuid()
  variantId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /** Source lot — traceability: which purchase the goods came from. */
  @IsOptional()
  @IsCuid()
  purchaseId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  item: string;

  @IsOptional()
  @IsObject()
  attributeSnapshot?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  qualityName?: string;

  @IsNumber()
  @Min(0.001)
  @Max(LIMITS.MAX_QTY)
  qty: number;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  unit: string;

  /** Price is locked from the purchase record, not typed freely. */
  @IsNumber()
  @Min(0)
  @Max(LIMITS.MAX_MONEY)
  rate: number;
}

export class CreateSaleDto {
  @IsDateString()
  date: string;

  @IsCuid()
  customerId: string;

  @IsArray()
  @ArrayMaxSize(LIMITS.MAX_LINES_PER_DOC)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleLineDto)
  lines: CreateSaleLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(LIMITS.MAX_MONEY)
  loadingCharges?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(LIMITS.MAX_MONEY)
  transportCharges?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(LIMITS.MAX_MONEY)
  labourCharges?: number;

  /** Money received at sale time — cannot exceed the invoice total. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(LIMITS.MAX_MONEY)
  paidNow?: number;
}
