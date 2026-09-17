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
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";
import { UsersService } from "./users.service";
import { CreateOwnerDto } from "./dto/create-owner.dto";
import { UpdateOwnerDto } from "./dto/update-owner.dto";
import { ApplyTemplatesDto } from "./dto/apply-templates.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";

/** Super Admin: create logins for business owners. Owners cannot self-register. */
@Controller("owners")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPERADMIN")
export class OwnersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query() pagination: PaginationDto) {
    const { skip, take } = skipTake(pagination.page, pagination.limit);
    const [items, total] = await this.usersService.listOwners(skip, take);
    return paginate(items, total, pagination.page, pagination.limit);
  }

  @Get(":id")
  getOne(@Param("id", ParseIdPipe) id: string) {
    return this.usersService.getOwner(id);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateOwnerDto) {
    return this.usersService.createOwner(dto, actor.sub);
  }

  @Patch(":id")
  update(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateOwnerDto,
  ) {
    return this.usersService.updateOwner(id, dto, actor.sub);
  }

  @Patch(":id/subscription")
  updateSubscription(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.usersService.updateOwnerSubscription(id, dto, actor.sub);
  }

  @Post(":id/templates")
  applyTemplates(
    @CurrentUser() actor: AuthUser,
    @Param("id", ParseIdPipe) id: string,
    @Body() dto: ApplyTemplatesDto,
  ) {
    return this.usersService.applyOwnerTemplates(id, dto.templateIds, actor.sub);
  }

  @Delete(":id")
  remove(@CurrentUser() actor: AuthUser, @Param("id", ParseIdPipe) id: string) {
    return this.usersService.deleteOwner(id, actor.sub);
  }
}
