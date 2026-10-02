import {
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  businessLogoUploadOptions,
  MulterFileInterceptor,
  type LogoUploadRequest,
} from "./multer.config";
import { MediaService } from "./media.service";

@Controller("media")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("business-logo")
  @Roles("SUPERADMIN", "ADMIN")
  @UseInterceptors(new MulterFileInterceptor("logo", businessLogoUploadOptions))
  async uploadBusinessLogo(@Req() req: LogoUploadRequest) {
    return this.media.uploadBusinessLogo(req.file);
  }
}
