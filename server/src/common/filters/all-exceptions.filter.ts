import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Central error handling (§16): every client-facing error has the same
 * shape; internal database errors never leak details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private prismaMessage(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (err.code) {
      case "P2002":
        return {
          status: HttpStatus.CONFLICT,
          message: "A record with that value already exists.",
          error: "Conflict",
        };
      case "P2025":
        return {
          status: HttpStatus.NOT_FOUND,
          message: "The requested record was not found.",
          error: "Not Found",
        };
      case "P2003":
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "This action references a record that no longer exists.",
          error: "Bad Request",
        };
      // Availability errors — the server is overloaded or the database is
      // unreachable. These must NOT be reported as client mistakes (400);
      // return 503 so clients and load balancers know to back off and retry.
      case "P2028": // interactive transaction exceeded its timeout
      case "P2024": // connection pool timeout
      case "P1001": // database unreachable
      case "P1017": // database connection closed
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: "The server is busy. Please try again.",
          error: "Service Unavailable",
        };
      default:
        this.logger.warn(
          `unmapped prisma error ${err.code} meta=${JSON.stringify(err.meta ?? {})}`,
        );
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "The request could not be completed. Check your data and try again.",
          error: "Bad Request",
        };
    }
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as { message?: string | string[]; error?: string };
        message = Array.isArray(b.message) ? b.message.join("; ") : b.message ?? message;
        error = b.error ?? error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.prismaMessage(exception);
      statusCode = mapped.status;
      message = mapped.message;
      error = mapped.error;
      this.logger.warn(`prisma ${exception.code} meta=${JSON.stringify(exception.meta ?? {})}`);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = "Invalid data sent to the server.";
      error = "Bad Request";
      this.logger.warn(exception.message);
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).send({ statusCode, message, error });
  }
}
