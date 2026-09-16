import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class AdjustInventoryDto {
  @IsString()
  productId: string;

  /** Signed: positive adds stock, negative removes it. */
  @IsNumber()
  qty: number;

  @IsISO8601()
  date: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}
