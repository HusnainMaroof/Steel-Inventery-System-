import { AuthUser } from "../common/decorators/current-user.decorator";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(user: AuthUser, dto: CreateProductDto): import(".prisma/client").Prisma.Prisma__ProductClient<{
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
    list(user: AuthUser): import(".prisma/client").Prisma.PrismaPromise<({
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
    byId(user: AuthUser, id: string): Promise<{
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
    update(user: AuthUser, id: string, dto: UpdateProductDto): Promise<{
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
    deactivate(user: AuthUser, id: string): Promise<{
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
    createCategory(user: AuthUser, id: string, dto: CreateCategoryDto): import(".prisma/client").Prisma.Prisma__ProductCategoryClient<{
        name: string;
        id: string;
        businessId: string;
        description: string | null;
        active: boolean;
        sortOrder: number;
        productId: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    createVariant(user: AuthUser, id: string, dto: CreateVariantDto): Promise<{
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
}
