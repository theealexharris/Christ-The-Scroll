import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { AppConfig } from "../config";

export function securityHeaders(config: AppConfig) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated JSON APIs: state-changing requests must
 * come from a trusted Origin (browsers always send it on cross-site POSTs) and
 * carry a JSON body, which cross-site HTML forms cannot produce.
 */
export function originCheck(config: AppConfig) {
  const trusted = new Set(config.trustedOrigins);
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get("origin");
    if (origin && !trusted.has(origin)) {
      res.status(403).json({ error: "Request origin is not allowed." });
      return;
    }
    const hasBody = Number(req.get("content-length") ?? 0) > 0 || req.get("transfer-encoding") !== undefined;
    if (hasBody && !req.is("application/json")) {
      res.status(415).json({ error: "Send requests as application/json." });
      return;
    }
    next();
  };
}

const keyByUser = (req: Request) => req.user?.id ?? req.ip ?? "anonymous";

export function aiRateLimiter(config: AppConfig) {
  return rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: config.aiRateLimitPer10Min,
    keyGenerator: keyByUser,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many AI requests. Please wait a few minutes and try again." },
  });
}

export function importRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: keyByUser,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many imports. Please wait a minute and try again." },
  });
}

export function authRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait and try again." },
  });
}
