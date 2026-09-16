export interface JwtPayload {
    sub: string;
    email: string;
    name: string;
    role: "ADMIN" | "SUBADMIN";
    businessId: string;
}
