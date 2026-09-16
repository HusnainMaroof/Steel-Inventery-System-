import {
  IsArray,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateSaleLineDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /** Source lot — traceability: which purchase the goods came from. */
  @IsOptional()
  @IsUUID()
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
  qty: number;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  unit: string;

  /** Price is locked from the purchase record, not typed freely. */
  @IsNumber()
  @Min(0)
  rate: number;
}

export class CreateSaleDto {
  @IsDateString()
  date: string;

  @IsUUID()
  customerId: string;

  @IsArray()
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
  loadingCharges?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transportCharges?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labourCharges?: number;

  /** Money received at sale time — cannot exceed the invoice total. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidNow?: number;
}
