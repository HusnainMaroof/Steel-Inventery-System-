import { BadRequestException } from "@nestjs/common";
import { CloudinaryService } from "./cloudinary.service";
import { ImageCompressService } from "./image-compress.service";
import { detectImageType } from "./image-signature";
import { MediaService } from "./media.service";

describe("detectImageType", () => {
  it("detects a PNG signature", () => {
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d4948445200000100",
      "hex",
    );
    expect(detectImageType(png)).toBe("png");
  });

  it("detects a JPEG signature", () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(20, 0xff),
    ]);
    expect(detectImageType(jpeg)).toBe("jpeg");
  });

  it("detects a WebP signature", () => {
    const webp = Buffer.from(
      "52494646000000005745425000000000",
      "hex",
    );
    expect(detectImageType(webp)).toBe("webp");
  });

  it("returns null for an SVG buffer", () => {
    const svg = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    expect(detectImageType(svg)).toBeNull();
  });

  it("returns null for a GIF buffer", () => {
    const gif = Buffer.from("GIF89a", "ascii");
    expect(detectImageType(gif)).toBeNull();
  });

  it("returns null for a RIFF WAVE buffer", () => {
    const wave = Buffer.from("524946460000000057415645", "hex");
    expect(detectImageType(wave)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it("returns null for a 2-byte buffer", () => {
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe("MediaService.uploadBusinessLogo signature check", () => {
  let mediaService: MediaService;
  let compress: { compress: jest.Mock };
  let cloudinary: { uploadBusinessLogo: jest.Mock };

  beforeEach(() => {
    compress = { compress: jest.fn() };
    cloudinary = { uploadBusinessLogo: jest.fn() };
    mediaService = new MediaService(
      compress as unknown as ImageCompressService,
      cloudinary as unknown as CloudinaryService,
    );
  });

  it("rejects an SVG buffer with BadRequestException and never calls the compress service", async () => {
    const svgBuffer = Buffer.from(
      "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    );
    const file = { buffer: svgBuffer } as Express.Multer.File;

    await expect(mediaService.uploadBusinessLogo(file)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      mediaService.uploadBusinessLogo(file),
    ).rejects.toThrow("Only PNG, JPEG, and WebP images are allowed");

    expect(compress.compress).not.toHaveBeenCalled();
    expect(cloudinary.uploadBusinessLogo).not.toHaveBeenCalled();
  });
});
