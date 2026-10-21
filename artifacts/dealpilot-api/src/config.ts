import { randomBytes } from "node:crypto";
import { z } from "zod";

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(8090),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (PostgreSQL connection string)."),
  BETTER_AUTH_SECRET: z.string().optional(),
  DEALPILOT_APP_URL: z.string().url().optional(),
  DEALPILOT_TRUSTED_ORIGINS: z.string().optional(),
  DEALPILOT_ALLOW_DEMO_ACCOUNTS: bool(true),
  DEALPILOT_AUTO_MIGRATE: bool(true),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEALPILOT_LLM_MODEL: z.string().default("claude-opus-5-5"),
  DEALPILOT_AI_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  MAPBOX_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  RENTCAST_API_KEY: z.string().optional(),
});

export type AppConfig = {
  env: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  authSecret: string;
  authSecretIsEphemeral: boolean;
  appUrl: string;
  trustedOrigins: string[];
  allowDemoAccounts: boolean;
  autoMigrate: boolean;
  llm: { provider: "anthropic"; apiKey: string | null; model: string };
  aiRateLimitPer10Min: number;
  integrationKeys: { mapbox: boolean; resend: boolean; stripe: boolean; rentcast: boolean };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid DealPilot configuration: ${details}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === "production";
  let authSecret = e.BETTER_AUTH_SECRET ?? "";
  let authSecretIsEphemeral = false;
  if (authSecret.length < 32) {
    if (isProduction) throw new Error("BETTER_AUTH_SECRET must be set to a random string of at least 32 characters in production.");
    authSecret = randomBytes(32).toString("hex");
    authSecretIsEphemeral = true;
  }
  const appUrl = (e.DEALPILOT_APP_URL ?? `http://localhost:${e.PORT}`).replace(/\/$/, "");
  const extra = (e.DEALPILOT_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const devOrigins = isProduction ? [] : ["http://localhost:5173", "http://localhost:5174"];
  return {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    authSecret,
    authSecretIsEphemeral,
    appUrl,
    trustedOrigins: Array.from(new Set([appUrl, ...extra, ...devOrigins])),
    allowDemoAccounts: e.DEALPILOT_ALLOW_DEMO_ACCOUNTS,
    autoMigrate: e.DEALPILOT_AUTO_MIGRATE,
    llm: { provider: "anthropic", apiKey: e.ANTHROPIC_API_KEY?.trim() || null, model: e.DEALPILOT_LLM_MODEL },
    aiRateLimitPer10Min: e.DEALPILOT_AI_RATE_LIMIT,
    integrationKeys: { mapbox: !!e.MAPBOX_TOKEN, resend: !!e.RESEND_API_KEY, stripe: !!e.STRIPE_SECRET_KEY, rentcast: !!e.RENTCAST_API_KEY },
  };
}
