import { PaymentMethod } from "@prisma/client";
export declare class CreatePaymentDto {
    date: string;
    type: "CUSTOMER" | "SUPPLIER";
    customerId?: string;
    supplierId?: string;
    amount: number;
    method?: PaymentMethod;
    saleId?: string;
    note?: string;
}
