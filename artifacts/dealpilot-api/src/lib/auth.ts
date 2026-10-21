import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import { anonymous } from "better-auth/plugins";
import type { NextFunction, Request, Response } from "express";
import { dpAccount, dpSession, dpUser, dpVerification, type DpDb } from "@workspace/dealpilot-db";
import type { AppConfig } from "../config";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string; isAnonymous: boolean };
    }
  }
}

/**
 * Better Auth handles password hashing (scrypt), session tokens and cookie
 * management; this app never touches raw passwords. Demo workspaces use the
 * anonymous plugin so each visitor gets an isolated, throwaway account.
 */
export function createAuth(db: DpDb, config: AppConfig) {
  return betterAuth({
    appName: "DealPilot AI",
    baseURL: config.appUrl,
    basePath: "/api/auth",
    secret: config.authSecret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: dpUser, session: dpSession, account: dpAccount, verification: dpVerification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: config.isProduction,
      window: 60,
      max: 30,
    },
    advanced: {
      useSecureCookies: config.appUrl.startsWith("https://"),
      cookiePrefix: "dealpilot",
    },
    telemetry: { enabled: false },
    plugins: config.allowDemoAccounts ? [anonymous({ emailDomainName: "demo.dealpilot.invalid" })] : [],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Loads the session (if any) onto `req.user`. Never throws for anonymous visitors. */
export function attachUser(auth: Auth) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (session?.user) {
        const u = session.user as typeof session.user & { isAnonymous?: boolean | null };
        req.user = { id: u.id, email: u.email, name: u.name, isAnonymous: !!u.isAnonymous };
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
}

/** Helper for handlers that run after `requireUser`. */
export function userId(req: Request): string {
  if (!req.user) throw new Error("requireUser middleware missing");
  return req.user.id;
}
