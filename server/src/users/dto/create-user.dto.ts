import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { STAFF_PAGES } from "../../common/staff-access";

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...STAFF_PAGES], { each: true })
  access: string[];

  @IsIn(["SUBADMIN"])
  role: "SUBADMIN";
}
