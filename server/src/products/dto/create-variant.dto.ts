import { IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateVariantDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  /** attribute key → display value; identity is derived from these pairs. */
  @IsObject()
  attributes: Record<string, string>;
}
