import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { RolesGuard } from "../common/guards/roles.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles("ADMIN")
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user.businessId);
  }

  /** ADMIN creates staff accounts — registration endpoint stays closed. */
  @Post()
  @Roles("ADMIN")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.businessId, dto);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.byId(user.sub);
  }
}
