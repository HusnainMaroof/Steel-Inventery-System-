import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateWarehouseDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
}

export class UpdateWarehouseDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateLocationDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
}

export class UpdateLocationDto extends UpdateWarehouseDto {}
