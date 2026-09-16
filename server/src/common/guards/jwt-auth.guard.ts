import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** JWT guard — everything except POST /api/v1/auth/login requires it (§15). */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
