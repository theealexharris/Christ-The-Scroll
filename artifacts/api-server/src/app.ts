import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { attachUser } from "./lib/auth";
import { logger } from "./lib/logger";

// esbuild bundles this whole server into a single artifacts/api-server/dist/index.mjs,
// so import.meta.url here always resolves to that bundle's own location.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../christ-scroll/dist/public");

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(attachUser);

app.use("/api", router);

// Serve the built React app for everything else, so this one service hosts both the API and the UI.
app.use(express.static(frontendDist));
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "GET" || req.path === "/api" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled request error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
