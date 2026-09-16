import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  /** Base unit — every quantity of this product is measured in it (kg, bag, …). */
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  unit: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsBoolean()
  usesCategories?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  specLabel?: string;
}
