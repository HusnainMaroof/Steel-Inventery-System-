import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RolesGuard } from "../common/guards/roles.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { ParseIdPipe } from "../common/pipes/parse-id.pipe";
import { UsersService } from "./users.service";
import { CreateOwnerDto } from "./dto/create-owner.dto";
import { UpdateOwnerDto } from "./dto/update-owner.dto";

/** Super Admin: create logins for business owners. Owners cannot self-register. */
@Controller("owners")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPERADMIN")
export class OwnersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.listOwners();
  }

  @Post()
  create(@Body() dto: CreateOwnerDto) {
    return this.usersService.createOwner(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseIdPipe) id: string, @Body() dto: UpdateOwnerDto) {
    return this.usersService.updateOwner(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIdPipe) id: string) {
    return this.usersService.removeOwner(id);
  }
}
