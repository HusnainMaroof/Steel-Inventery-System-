"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseGoodsTotal = purchaseGoodsTotal;
exports.landedCostTotal = landedCostTotal;
exports.landedCostPerUnit = landedCostPerUnit;
exports.saleSubtotal = saleSubtotal;
exports.saleGrandTotal = saleGrandTotal;
exports.profitOnSales = profitOnSales;
exports.round2 = round2;
function purchaseGoodsTotal(lines) {
    return round2(lines.reduce((sum, l) => sum + l.qty * l.rate, 0));
}
function landedCostTotal(input) {
    return round2(input.goodsTotal + input.transport + input.loading + input.labour + input.other);
}
function landedCostPerUnit(input) {
    if (input.qty <= 0)
        return 0;
    return round2((input.qty * input.rate + input.purchaseCharges) / input.qty);
}
function saleSubtotal(lines) {
    return round2(lines.reduce((sum, l) => sum + l.qty * l.rate, 0));
}
function saleGrandTotal(lines, charges) {
    const subtotal = saleSubtotal(lines);
    const discount = round2(subtotal * (charges.discountPct / 100));
    const taxable = round2(subtotal - discount);
    const tax = round2(taxable * (charges.taxPct / 100));
    const chargesTotal = round2(charges.loading + charges.transport + charges.labour);
    return {
        subtotal,
        discount,
        taxable,
        tax,
        chargesTotal,
        grandTotal: round2(taxable + tax + chargesTotal),
    };
}
function profitOnSales(input) {
    return round2(input.salesRevenue - input.stockCost);
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=money.js.map