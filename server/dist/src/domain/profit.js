"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attributedLineRevenue = attributedLineRevenue;
exports.computeProfit = computeProfit;
function attributedLineRevenue(sale, line) {
    const subtotal = sale.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
    if (subtotal <= 0)
        return 0;
    const charges = sale.loading + sale.transport + sale.labour - subtotal * (sale.discountPct / 100);
    const withTax = charges * (1 + sale.taxPct / 100);
    const share = (line.qty * line.rate) / subtotal;
    return round2(line.qty * line.rate + withTax * share);
}
function computeProfit(sales, expenses, options = {}) {
    let salesRevenue = 0;
    let stockCost = 0;
    for (const sale of sales) {
        const subtotal = sale.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
        if (subtotal <= 0)
            continue;
        const charges = sale.loading + sale.transport + sale.labour - subtotal * (sale.discountPct / 100);
        const withTax = charges * (1 + sale.taxPct / 100);
        for (const line of sale.lines) {
            const share = (line.qty * line.rate) / subtotal;
            salesRevenue += line.qty * line.rate + withTax * share;
            stockCost += line.qty * line.unitCost;
        }
    }
    salesRevenue = round2(salesRevenue);
    stockCost = round2(stockCost);
    const profitOnSales = round2(salesRevenue - stockCost);
    const totalExpenses = round2(expenses
        .filter((e) => !options.productId || e.productId === options.productId)
        .reduce((sum, e) => sum + e.amount, 0));
    const netProfit = round2(profitOnSales - totalExpenses);
    const profitPct = salesRevenue > 0 ? round2((netProfit / salesRevenue) * 100) : 0;
    return { salesRevenue, stockCost, profitOnSales, totalExpenses, netProfit, profitPct };
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=profit.js.map