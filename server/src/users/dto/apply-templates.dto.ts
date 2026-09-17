import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from "class-validator";

export class ApplyTemplatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  templateIds: string[];
}
