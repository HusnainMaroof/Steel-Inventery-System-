import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
export declare class ProductsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateProductDto): import(".prisma/client").Prisma.Prisma__ProductClient<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        unit: string;
        description: string | null;
        usesCategories: boolean;
        specLabel: string | null;
        active: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    list(businessId: string): import(".prisma/client").Prisma.PrismaPromise<({
        variants: {
            id: string;
            businessId: string;
            createdAt: Date;
            categoryId: string | null;
            attributes: import("@prisma/client/runtime/library").JsonValue;
            active: boolean;
            productId: string;
            identityKey: string | null;
            key: string;
            shortName: string;
        }[];
        categories: {
            name: string;
            id: string;
            businessId: string;
            description: string | null;
            active: boolean;
            sortOrder: number;
            productId: string;
        }[];
    } & {
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        unit: string;
        description: string | null;
        usesCategories: boolean;
        specLabel: string | null;
        active: boolean;
    })[]>;
    byId(businessId: string, id: string): Promise<{
        attributeDefs: ({
            options: {
                id: string;
                defId: string;
                value: string;
            }[];
        } & {
            name: string;
            id: string;
            businessId: string;
            categoryId: string | null;
            productId: string;
            key: string;
            type: string;
            required: boolean;
        })[];
        variants: {
            id: string;
            businessId: string;
            createdAt: Date;
            categoryId: string | null;
            attributes: import("@prisma/client/runtime/library").JsonValue;
            active: boolean;
            productId: string;
            identityKey: string | null;
            key: string;
            shortName: string;
        }[];
        categories: {
            name: string;
            id: string;
            businessId: string;
            description: string | null;
            active: boolean;
            sortOrder: number;
            productId: string;
        }[];
        items: {
            name: string;
            id: string;
            businessId: string;
            productId: string;
        }[];
    } & {
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        unit: string;
        description: string | null;
        usesCategories: boolean;
        specLabel: string | null;
        active: boolean;
    }>;
    update(businessId: string, id: string, dto: UpdateProductDto): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        unit: string;
        description: string | null;
        usesCategories: boolean;
        specLabel: string | null;
        active: boolean;
    }>;
    deactivate(businessId: string, id: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        unit: string;
        description: string | null;
        usesCategories: boolean;
        specLabel: string | null;
        active: boolean;
    }>;
    createCategory(businessId: string, productId: string, dto: CreateCategoryDto): import(".prisma/client").Prisma.Prisma__ProductCategoryClient<{
        name: string;
        id: string;
        businessId: string;
        description: string | null;
        active: boolean;
        sortOrder: number;
        productId: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    createVariant(businessId: string, productId: string, dto: CreateVariantDto): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        categoryId: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        active: boolean;
        productId: string;
        identityKey: string | null;
        key: string;
        shortName: string;
    }>;
    private assertExists;
}
