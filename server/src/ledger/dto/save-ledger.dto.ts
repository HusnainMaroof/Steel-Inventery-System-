import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { UiSettingsDto } from "./ui-settings.dto";

export class SaveLedgerDto {
  @ValidateNested()
  @Type(() => UiSettingsDto)
  data!: UiSettingsDto;
}
