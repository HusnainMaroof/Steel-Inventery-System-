import { IsISO8601, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class StockChecksListQueryDto extends PaginationDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
