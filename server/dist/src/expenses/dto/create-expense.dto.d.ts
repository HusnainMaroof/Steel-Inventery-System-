import { ExpenseCategory } from "@prisma/client";
export declare class CreateExpenseDto {
    date: string;
    label: string;
    category: ExpenseCategory;
    amount: number;
    productId?: string;
}
