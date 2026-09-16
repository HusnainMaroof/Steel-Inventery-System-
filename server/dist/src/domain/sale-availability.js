"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockLevelsFromLedger = stockLevelsFromLedger;
exports.findShortages = findShortages;
function stockLevelsFromLedger(tx) {
    const levels = new Map();
    for (const t of tx) {
        levels.set(t.productId, (levels.get(t.productId) ?? 0) + t.qty);
    }
    return levels;
}
function findShortages(levels, requested) {
    const shortages = [];
    for (const line of requested) {
        const available = levels.get(line.productId) ?? 0;
        const missing = round3(line.qty - available);
        if (missing > 0.0005) {
            shortages.push({
                productId: line.productId,
                available,
                requested: line.qty,
                missing,
            });
        }
    }
    return shortages;
}
function round3(n) {
    return Math.round(n * 1000) / 1000;
}
//# sourceMappingURL=sale-availability.js.map