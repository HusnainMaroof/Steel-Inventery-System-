import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PaymentMethod } from "@prisma/client";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";

export class CreatePaymentDto {
  @IsDateString()
  date: string;

  @IsEnum({ CUSTOMER: "CUSTOMER", SUPPLIER: "SUPPLIER" })
  type: "CUSTOMER" | "SUPPLIER";

  @IsOptional()
  @IsCuid()
  customerId?: string;

  @IsOptional()
  @IsCuid()
  supplierId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  /** Settle one specific invoice — can never exceed its remaining due. */
  @IsOptional()
  @IsCuid()
  saleId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  note?: string;
}
