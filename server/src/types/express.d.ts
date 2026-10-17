import type { SessionUser } from "../modules/auth/auth.middleware";

declare global {
  namespace Express {
    interface Locals {
      /** Set by `loadSession` for signed-in requests. */
      user?: SessionUser;
    }
  }
}

export {};
