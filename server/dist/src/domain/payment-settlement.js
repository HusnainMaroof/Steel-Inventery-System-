"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleFifo = settleFifo;
exports.supplierPayable = supplierPayable;
function settleFifo(openInvoices, amount) {
    const ordered = [...openInvoices]
        .filter((i) => i.total - i.paidSoFar > 0.005)
        .sort((a, b) => a.date.localeCompare(b.date) || a.saleId.localeCompare(b.saleId));
    let left = amount;
    const allocations = [];
    for (const invoice of ordered) {
        if (left <= 0.005)
            break;
        const due = round2(invoice.total - invoice.paidSoFar);
        const take = Math.min(due, left);
        if (take > 0.005) {
            allocations.push({ saleId: invoice.saleId, amount: round2(take) });
            left = round2(left - take);
        }
    }
    return { allocations, unallocated: round2(Math.max(0, left)) };
}
function supplierPayable(purchases) {
    return round2(purchases.reduce((sum, p) => sum + Math.max(0, p.goodsTotal - p.paid), 0));
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=payment-settlement.js.map