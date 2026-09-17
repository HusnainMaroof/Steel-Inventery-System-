import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateAttributeDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsString() @MinLength(1) @MaxLength(80) key: string;
  @IsIn(["text", "number", "select", "boolean", "date", "measurement"])
  type: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsString() @MaxLength(16) unit?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() categoryId?: string;
}

export class UpdateAttributeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) key?: string;
  @IsOptional() @IsIn(["text", "number", "select", "boolean", "date", "measurement"]) type?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsString() @MaxLength(16) unit?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateOptionDto {
  @IsString() @MinLength(1) @MaxLength(80) label: string;
  @IsOptional() @IsString() @MaxLength(80) value?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateOptionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) label?: string;
  @IsOptional() @IsString() @MaxLength(80) value?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateVariantDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) shortName?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ReorderDto {
  @IsArray() @IsString({ each: true }) ids: string[];
}

export class VariantAttributesDto {
  @IsObject() attributes: Record<string, string>;
}
