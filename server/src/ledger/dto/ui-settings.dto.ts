import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

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
  @IsEmail()
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
}
