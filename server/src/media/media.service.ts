import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { CloudinaryService } from "./cloudinary.service";
import { ImageCompressService } from "./image-compress.service";

@Injectable()
export class MediaService {
  constructor(
    private readonly compress: ImageCompressService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async uploadBusinessLogo(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Logo image is required");
    }

    const compressed = await this.compress.compress(file.buffer);
    const key = `logo-${randomUUID()}`;
    const uploaded = await this.cloudinary.uploadBusinessLogo(compressed, key);

    return {
      url: uploaded.url,
      publicId: uploaded.publicId,
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
    };
  }
}
