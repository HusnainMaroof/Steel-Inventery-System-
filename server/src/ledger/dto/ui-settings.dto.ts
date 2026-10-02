import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/** Blank means "no invoice email" — the settings form sends "" when untouched. */
const blankToUndefined = ({ value }: { value: unknown }): unknown => {
  const trimmed = typeof value === "string" ? value.trim() : value;
  return trimmed === "" ? undefined : trimmed;
};

export class UiSettingsDto {
  @IsOptional()
  @IsBoolean()
  showOptionalDetails?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsEmail({}, { message: "Invoice email is not valid" })
  @MaxLength(120)
  invoiceEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  invoiceNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(450_000)
  logoDataUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}
