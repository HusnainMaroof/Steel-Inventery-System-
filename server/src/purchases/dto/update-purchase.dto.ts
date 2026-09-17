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
import { CreatePurchaseLineDto } from "./create-purchase.dto";

export class UpdatePurchaseDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreatePurchaseLineDto)
  lines?: CreatePurchaseLineDto[];
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @IsOptional() @IsNumber() @Min(0) transport?: number;
  @IsOptional() @IsNumber() @Min(0) loading?: number;
  @IsOptional() @IsNumber() @Min(0) labour?: number;
  @IsOptional() @IsNumber() @Min(0) otherCost?: number;
  @IsOptional() @IsNumber() @Min(0) paid?: number;
}
