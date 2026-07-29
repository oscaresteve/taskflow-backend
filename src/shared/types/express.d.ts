import type { User } from "../../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      user: User;

      validated: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
