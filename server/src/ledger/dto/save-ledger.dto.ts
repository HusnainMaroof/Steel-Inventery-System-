import { IsObject } from "class-validator";

export class SaveLedgerDto {
  @IsObject()
  data!: Record<string, unknown>;
}
