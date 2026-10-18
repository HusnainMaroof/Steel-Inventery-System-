import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";
import { CreatePurchaseLineDto } from "./create-purchase.dto";

export class UpdatePurchaseLineDto extends CreatePurchaseLineDto {
  /** Existing line to update in place. Omit to insert a new line. */
  @IsOptional()
  @IsCuid()
  id?: string;
}

export class UpdatePurchaseDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdatePurchaseLineDto)
  lines?: UpdatePurchaseLineDto[];
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @IsOptional() @IsNumber() @Min(0) transport?: number;
  @IsOptional() @IsNumber() @Min(0) loading?: number;
  @IsOptional() @IsNumber() @Min(0) labour?: number;
  @IsOptional() @IsNumber() @Min(0) otherCost?: number;
  @IsOptional() @IsNumber() @Min(0) paid?: number;
}
