export interface OpenInvoice {
    saleId: string;
    total: number;
    paidSoFar: number;
    date: string;
}
export interface Allocation {
    saleId: string;
    amount: number;
}
export interface SettlementResult {
    allocations: Allocation[];
    unallocated: number;
}
export declare function settleFifo(openInvoices: OpenInvoice[], amount: number): SettlementResult;
export declare function supplierPayable(purchases: {
    goodsTotal: number;
    paid: number;
}[]): number;
