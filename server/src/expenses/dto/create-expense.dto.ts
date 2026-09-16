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
import { ExpenseCategory } from "@prisma/client";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";

export class CreateExpenseDto {
  @IsDateString()
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsNumber()
  @Min(0.01)
  amount: number;

  /** Absent = whole shop; set = this product's own expense. */
  @IsOptional()
  @IsCuid()
  productId?: string;
}
