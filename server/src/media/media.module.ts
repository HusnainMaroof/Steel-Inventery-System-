import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { CloudinaryService } from "./cloudinary.service";
import { ImageCompressService } from "./image-compress.service";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [ConfigModule],
  controllers: [MediaController],
  providers: [MediaService, ImageCompressService, CloudinaryService],
  exports: [MediaService, CloudinaryService],
})
export class MediaModule {}
