import type { NextFunction, Request, Response } from "express";
import type { ZodSchema, ZodTypeDef } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found.`);

/** Parses `input` with a Zod schema, throwing a 400 with field-level details on failure. */
export function parseOrThrow<T>(schema: ZodSchema<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] ??= issue.message;
    }
    throw new HttpError(400, "Some fields need attention.", { fieldErrors });
  }
  return result.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates a route `:param` as a UUID; malformed ids are reported as not found. */
export function uuidParam(req: Request, name: string, what?: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || !UUID_RE.test(value)) throw notFound(what);
  return value;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  if (typeof err === "object" && err !== null && "type" in err && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (typeof err === "object" && err !== null && "type" in err && (err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON." });
    return;
  }
  req.log?.error({ err }, "Unhandled request error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
