declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    user?: {
      id?: string;
      role?: string;
    };
    tx?: unknown;
  }
}

export {};
