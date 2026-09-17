import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { parseBusinessLogoUpload } from "./multer.config";
import { MediaService } from "./media.service";

@Controller("media")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("business-logo")
  @Roles("SUPERADMIN", "ADMIN")
  async uploadBusinessLogo(@Req() req: FastifyRequest) {
    let file: Express.Multer.File | undefined;
    try {
      file = await parseBusinessLogoUpload(req);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid logo upload";
      throw new BadRequestException(message);
    }

    return this.media.uploadBusinessLogo(file!);
  }
}
