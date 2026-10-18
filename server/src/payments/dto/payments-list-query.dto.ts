import { IsIn, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class PaymentsListQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(["customer", "supplier"])
  type?: "customer" | "supplier";
}
