import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, runMigrations } from "@workspace/dealpilot-db";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createAuth } from "./lib/auth";
import { logger } from "./lib/logger";
import { createAnalyst } from "./llm/provider";
import { seedSampleCatalog } from "./services/properties";

// esbuild bundles the server into artifacts/dealpilot-api/dist/index.mjs, so
// paths below are relative to that bundle.
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../../lib/dealpilot-db/drizzle");
const staticDir = path.resolve(here, "../../dealpilot/dist/public");

async function main() {
  const config = loadConfig();
  if (config.authSecretIsEphemeral) logger.warn("BETTER_AUTH_SECRET is not set; using a temporary secret. Sessions will reset on restart.");
  const { db, pool } = createDb(config.databaseUrl);

  if (config.autoMigrate) {
    await runMigrations(db, migrationsFolder);
    logger.info("Database migrations applied");
  }
  const seeded = await seedSampleCatalog(db);
  if (seeded > 0) logger.info({ seeded }, "Seeded fictional sample properties");

  const analyst = createAnalyst(config);
  logger.info({ aiMode: analyst.mode, model: analyst.model }, "AI analyst configured");

  const app = createApp({ db, auth: createAuth(db, config), config, analyst, staticDir });
  const server = app.listen(config.port, () => logger.info({ port: config.port, appUrl: config.appUrl }, "DealPilot API listening"));

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start DealPilot API");
  process.exit(1);
});
