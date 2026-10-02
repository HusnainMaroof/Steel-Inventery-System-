import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";
import { ConfigService } from "../config/config.service";

const UPLOAD_FAILED_MESSAGE = "Image is not uploaded. Please try again.";

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
};

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {
    const { cloudName, apiKey, apiSecret } = this.config.cloudinary;
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.configured = true;
    } else {
      this.logger.warn(
        "Cloudinary credentials missing (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)",
      );
    }
  }

  uploadBusinessLogo(buffer: Buffer, key: string): Promise<CloudinaryUploadResult> {
    if (!this.configured) {
      throw new BadRequestException(UPLOAD_FAILED_MESSAGE);
    }
    const folder = this.config.cloudinary.folder;

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: key,
          resource_type: "image",
          format: "webp",
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              `Cloudinary upload failed: ${error?.message ?? "empty result"}`,
            );
            reject(new BadRequestException(UPLOAD_FAILED_MESSAGE));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width ?? 0,
            height: result.height ?? 0,
            bytes: result.bytes ?? buffer.length,
          });
        },
      );
      stream.end(buffer);
    });
  }
}
