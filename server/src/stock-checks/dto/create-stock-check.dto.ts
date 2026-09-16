import { IsDateString, IsNumber, IsUUID, Min } from "class-validator";

export class CreateStockCheckDto {
  @IsDateString()
  date: string;

  @IsUUID()
  productId: string;

  /** What was actually counted in the yard — never copied from the system. */
  @IsNumber()
  @Min(0)
  physicalQty: number;
}
