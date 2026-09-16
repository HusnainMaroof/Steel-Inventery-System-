import {
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  mill: string;

  @IsString()
  @MinLength(4)
  @MaxLength(20)
  phone: string;
}
