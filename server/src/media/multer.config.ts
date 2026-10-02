import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import multer from "multer";
import type { Observable } from "rxjs";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_LOGO_BYTES = 8 * 1024 * 1024;

/** Real multer options for the business logo (memory storage, strict filter). */
export const businessLogoUploadOptions: multer.Options = {
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new BadRequestException("Only PNG, JPEG, and WebP images are allowed"));
  },
};

export type LogoUploadRequest = FastifyRequest & {
  file?: Express.Multer.File;
};

type RawRequestWithFile = LogoUploadRequest["raw"] & {
  file?: Express.Multer.File;
};

type UploadHandler = ReturnType<multer.Multer["single"]>;
/** Express request/response shapes multer expects (raw Node objects work at runtime). */
type UploadReq = Parameters<UploadHandler>[0];
type UploadRes = Parameters<UploadHandler>[1];

function toUploadException(err: unknown): BadRequestException {
  if (err instanceof BadRequestException) return err;
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: string }).code
      : undefined;
  if (code === "LIMIT_FILE_SIZE") {
    return new BadRequestException("Image is too large. Use a file under 8 MB.");
  }
  return new BadRequestException("Invalid logo upload");
}

/**
 * Nest FileInterceptor-style wrapper around real multer. Fastify has no multer
 * adapter, so the middleware runs on the raw Node request/response pair and the
 * parsed file lands on `req.file` for the handler.
 */
@Injectable()
export class MulterFileInterceptor implements NestInterceptor {
  private readonly upload: UploadHandler;

  constructor(fieldName: string, options: multer.Options) {
    this.upload = multer(options).single(fieldName);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<LogoUploadRequest>();
    const res = http.getResponse<FastifyReply>();

    await new Promise<void>((resolve, reject) => {
      this.upload(
        req.raw as unknown as UploadReq,
        res.raw as unknown as UploadRes,
        (err?: unknown) => {
          if (err) {
            reject(toUploadException(err));
            return;
          }
          req.file = (req.raw as RawRequestWithFile).file;
          resolve();
        },
      );
    });

    return next.handle();
  }
}
