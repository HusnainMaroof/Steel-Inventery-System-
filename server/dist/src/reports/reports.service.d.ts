import { PrismaService } from "../prisma/prisma.service";
export type ReportMode = "month" | "year" | "range";
export interface ProfitReportInput {
    mode: ReportMode;
    year: number;
    month?: number;
    from?: string;
    to?: string;
    productId?: string;
}
export declare class ReportsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    profit(businessId: string, input: ProfitReportInput): Promise<{
        period: string;
        productScope: string;
        profit: import("../domain/profit").ProfitResult;
        stock: {
            productId: string;
            productName: string;
            unit: string;
            openingQty: number;
            remainingQty: number;
        }[];
        dues: {
            customerDue: number;
            supplierDue: number;
        };
        cash: {
            cashReceived: number;
            cashPaid: number;
            expenses: number;
            cashInHand: number;
        };
        remainingValuation: number;
        businessValue: number;
        salesGrandTotals: number[];
    }>;
    private periodOf;
}
