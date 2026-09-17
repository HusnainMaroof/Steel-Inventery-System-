import type { FastifyRequest } from "fastify";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function parseBusinessLogoUpload(
  req: FastifyRequest,
): Promise<Express.Multer.File | undefined> {
  const part = await req.file();
  if (!part) return undefined;

  const buffer = await part.toBuffer();
  const mimetype = part.mimetype;
  if (!ALLOWED_MIME.has(mimetype)) {
    throw new Error("Only PNG, JPEG, and WebP images are allowed");
  }

  return {
    fieldname: part.fieldname,
    originalname: part.filename,
    encoding: part.encoding,
    mimetype,
    size: buffer.length,
    buffer,
    stream: part.file,
    destination: "",
    filename: part.filename,
    path: "",
  };
}
