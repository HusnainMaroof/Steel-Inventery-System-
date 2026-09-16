import { AuthUser } from "../common/decorators/current-user.decorator";
import { ReportsService, ReportMode } from "./reports.service";
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    profit(user: AuthUser, mode?: ReportMode, year?: string, month?: string, from?: string, to?: string, productId?: string): Promise<{
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
}
