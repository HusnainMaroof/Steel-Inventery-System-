export interface AuthUser {
    sub: string;
    email: string;
    name: string;
    role: "ADMIN" | "SUBADMIN";
    businessId: string;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
