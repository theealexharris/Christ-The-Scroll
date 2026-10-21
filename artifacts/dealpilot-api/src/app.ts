import fs from "node:fs";
import path from "node:path";
import { toNodeHandler } from "better-auth/node";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import pinoHttp from "pino-http";
import type { DpDb } from "@workspace/dealpilot-db";
import type { AppConfig } from "./config";
import { attachUser, type Auth } from "./lib/auth";
import { errorHandler } from "./lib/http";
import { logger } from "./lib/logger";
import { authRateLimiter, originCheck, securityHeaders } from "./lib/security";
import type { AnalystProvider } from "./llm/provider";
import { createApiRouter } from "./routes";

export type AppDeps = {
  db: DpDb;
  auth: Auth;
  config: AppConfig;
  analyst: AnalystProvider;
  /** Built web app to serve (single-service deploys). Omit in tests/dev. */
  staticDir?: string;
};

export function createApp({ db, auth, config, analyst, staticDir }: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  // Render/Replit terminate TLS at a proxy; trust one hop so req.ip and secure cookies work.
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url?.split("?")[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(securityHeaders(config));

  // Better Auth parses its own bodies, so it is mounted before express.json().
  app.use("/api/auth", authRateLimiter(), originCheck(config));
  app.all("/api/auth/{*splat}", toNodeHandler(auth));

  app.use("/api", express.json({ limit: "1.5mb" }));
  app.use("/api", originCheck(config));
  app.use("/api", attachUser(auth));
  app.use("/api", createApiRouter({ db, config, analyst }));

  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
