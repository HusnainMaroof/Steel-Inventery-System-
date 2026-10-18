import { IsOptional } from "class-validator";
import { IsCuid } from "../../common/decorators/is-cuid.decorator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class SalesListQueryDto extends PaginationDto {
  @IsOptional()
  @IsCuid()
  customerId?: string;
}
