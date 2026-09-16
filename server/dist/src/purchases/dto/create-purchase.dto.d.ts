export declare class CreatePurchaseLineDto {
    productId: string;
    variantId?: string;
    categoryId?: string;
    item: string;
    attributeSnapshot?: Record<string, string>;
    qty: number;
    unit: string;
    rate: number;
    sellRate?: number;
}
export declare class CreatePurchaseDto {
    date: string;
    supplierId: string;
    lines: CreatePurchaseLineDto[];
    notes?: string;
    transport?: number;
    loading?: number;
    labour?: number;
    otherCost?: number;
    paid?: number;
}
