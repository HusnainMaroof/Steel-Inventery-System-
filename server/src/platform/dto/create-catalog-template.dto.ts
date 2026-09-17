import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

class CatalogTemplateAttributeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(["text", "number", "select"])
  type!: "text" | "number" | "select";

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateCatalogTemplateDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsString()
  @MinLength(1)
  productName!: string;

  @IsString()
  @MinLength(1)
  productUnit!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  usesCategories?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CatalogTemplateAttributeDto)
  attributes!: CatalogTemplateAttributeDto[];
}
