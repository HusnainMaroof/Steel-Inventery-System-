import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PaginationDto, paginate, skipTake } from "../common/dto/pagination.dto";
import { RolesGuard } from "../common/guards/roles.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

/** Business owner: manage staff logins for their shop. */
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.usersService.listStaff(
      user.businessId,
      skip,
      take,
    );
    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.createStaff(user.businessId, dto, user.sub);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateStaff(user.businessId, id, dto, user.sub);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.usersService.removeStaff(user.businessId, id, user.sub);
  }
}
