import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const SESSION_COOKIE = "cts_session";
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set.");
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function issueSession(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, getSecret(), { expiresIn: "30d" });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS_MS,
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE);
}

export function getSessionUserId(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !token) return null;
  try {
    const payload = jwt.verify(token, getSecret());
    if (typeof payload === "object" && payload !== null && typeof payload.sub === "string") return payload.sub;
    return null;
  } catch {
    return null;
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const userId = getSessionUserId(req);
  if (userId) req.userId = userId;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
}
