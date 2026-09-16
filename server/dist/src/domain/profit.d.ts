export interface SaleLineForProfit {
    productId: string;
    qty: number;
    rate: number;
    unitCost: number;
}
export interface SaleForProfit {
    saleId: string;
    lines: SaleLineForProfit[];
    discountPct: number;
    taxPct: number;
    loading: number;
    transport: number;
    labour: number;
}
export interface ExpenseForProfit {
    productId?: string;
    amount: number;
}
export interface ProfitResult {
    salesRevenue: number;
    stockCost: number;
    profitOnSales: number;
    totalExpenses: number;
    netProfit: number;
    profitPct: number;
}
export declare function attributedLineRevenue(sale: SaleForProfit, line: SaleLineForProfit): number;
export declare function computeProfit(sales: SaleForProfit[], expenses: ExpenseForProfit[], options?: {
    productId?: string;
}): ProfitResult;
