import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class CreatePaymentDto {
  @IsDateString()
  date: string;

  @IsEnum({ CUSTOMER: "CUSTOMER", SUPPLIER: "SUPPLIER" })
  type: "CUSTOMER" | "SUPPLIER";

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  /** Settle one specific invoice — can never exceed its remaining due. */
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  note?: string;
}
