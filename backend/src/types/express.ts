declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    user?: {
      id?: string;
      role?: "USER" | "ADMIN" | "SUPER_ADMIN";
    };
    tx?: unknown;
  }
}

export {};
