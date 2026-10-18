import { IsIn, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class InvoicesListQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(["true", "false"])
  dueOnly?: string;
}
