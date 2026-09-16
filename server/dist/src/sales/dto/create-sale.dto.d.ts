export declare class CreateSaleLineDto {
    productId: string;
    variantId?: string;
    categoryId?: string;
    purchaseId?: string;
    item: string;
    attributeSnapshot?: Record<string, string>;
    qualityName?: string;
    qty: number;
    unit: string;
    rate: number;
}
export declare class CreateSaleDto {
    date: string;
    customerId: string;
    lines: CreateSaleLineDto[];
    notes?: string;
    discountPct?: number;
    taxPct?: number;
    loadingCharges?: number;
    transportCharges?: number;
    labourCharges?: number;
    paidNow?: number;
}
