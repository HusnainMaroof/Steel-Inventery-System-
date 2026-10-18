import { IsISO8601, IsOptional } from "class-validator";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class ExpensesListQueryDto extends PaginationDto {
  @IsOptional()
  @IsCuid()
  productId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
