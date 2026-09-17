import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";

export class CreateStockCheckDto {
  @IsDateString()
  date: string;

  @IsCuid()
  productId: string;

  /** What was actually counted in the yard — never copied from the system. */
  @IsNumber()
  @Min(0)
  physicalQty: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
