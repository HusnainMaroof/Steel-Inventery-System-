import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class SuppliersListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
