export declare class PaginationDto {
    page: number;
    limit: number;
}
export interface Paginated<T> {
    items: T[];
    page: number;
    limit: number;
    total: number;
    pages: number;
}
export declare function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T>;
export declare function skipTake(page: number, limit: number): {
    skip: number;
    take: number;
};
