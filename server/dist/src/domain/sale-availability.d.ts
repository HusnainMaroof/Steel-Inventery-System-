export interface StockLevel {
    productId: string;
    available: number;
}
export interface RequestedLine {
    productId: string;
    qty: number;
}
export interface Shortage {
    productId: string;
    available: number;
    requested: number;
    missing: number;
}
export declare function stockLevelsFromLedger(tx: {
    productId: string;
    qty: number;
}[]): Map<string, number>;
export declare function findShortages(levels: Map<string, number>, requested: RequestedLine[]): Shortage[];
