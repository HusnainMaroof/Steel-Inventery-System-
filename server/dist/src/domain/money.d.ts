export declare function purchaseGoodsTotal(lines: {
    qty: number;
    rate: number;
}[]): number;
export declare function landedCostTotal(input: {
    goodsTotal: number;
    transport: number;
    loading: number;
    labour: number;
    other: number;
}): number;
export declare function landedCostPerUnit(input: {
    qty: number;
    rate: number;
    purchaseCharges: number;
}): number;
export interface SaleLineInput {
    qty: number;
    rate: number;
}
export interface SaleChargesInput {
    discountPct: number;
    taxPct: number;
    loading: number;
    transport: number;
    labour: number;
}
export declare function saleSubtotal(lines: SaleLineInput[]): number;
export declare function saleGrandTotal(lines: SaleLineInput[], charges: SaleChargesInput): {
    subtotal: number;
    discount: number;
    taxable: number;
    tax: number;
    chargesTotal: number;
    grandTotal: number;
};
export declare function profitOnSales(input: {
    salesRevenue: number;
    stockCost: number;
}): number;
export declare function round2(n: number): number;
