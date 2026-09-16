import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  shop?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  phone?: string;
}
