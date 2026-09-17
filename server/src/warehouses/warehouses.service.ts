import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateLocationDto,
  CreateWarehouseDto,
  UpdateLocationDto,
  UpdateWarehouseDto,
} from "./warehouse.dto";

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.warehouse.findMany({
      where: { businessId },
      include: { locations: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });
  }

  create(businessId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: { businessId, name: dto.name } });
  }

  async update(businessId: string, id: string, dto: UpdateWarehouseDto) {
    await this.assertWarehouse(businessId, id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async remove(businessId: string, id: string) {
    await this.assertWarehouse(businessId, id);
    const used = await this.prisma.purchaseLine.count({
      where: { purchase: { businessId }, warehouseId: id },
    });
    if (used) throw new ConflictException("Warehouse is referenced by purchase history");
    await this.prisma.warehouse.delete({ where: { id } });
    return { deleted: true, warehouseId: id };
  }

  async createLocation(businessId: string, warehouseId: string, dto: CreateLocationDto) {
    await this.assertWarehouse(businessId, warehouseId);
    return this.prisma.location.create({
      data: { businessId, warehouseId, name: dto.name },
    });
  }

  async updateLocation(businessId: string, id: string, dto: UpdateLocationDto) {
    await this.assertLocation(businessId, id);
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async removeLocation(businessId: string, id: string) {
    await this.assertLocation(businessId, id);
    const used = await this.prisma.purchaseLine.count({
      where: { purchase: { businessId }, locationId: id },
    });
    if (used) throw new ConflictException("Location is referenced by purchase history");
    await this.prisma.location.delete({ where: { id } });
    return { deleted: true, locationId: id };
  }

  private async assertWarehouse(businessId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, businessId } });
    if (!warehouse) throw new NotFoundException("Warehouse not found");
    return warehouse;
  }

  private async assertLocation(businessId: string, id: string) {
    const location = await this.prisma.location.findFirst({ where: { id, businessId } });
    if (!location) throw new NotFoundException("Location not found");
    return location;
  }
}
