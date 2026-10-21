import { sql } from "drizzle-orm";
import request from "supertest";
import { createDb, runMigrations, type DpDb } from "@workspace/dealpilot-db";
import { createApp } from "../app";
import { loadConfig, type AppConfig } from "../config";
import { createAuth } from "../lib/auth";
import { DemoAnalyst, type AnalystProvider } from "../llm/provider";
import { seedSampleCatalog } from "../services/properties";

export const TEST_DB_URL = process.env.DEALPILOT_TEST_DATABASE_URL;
export const ORIGIN = "http://localhost:8090";

let shared: { db: DpDb; end: () => Promise<void> } | null = null;

/** Resets the test database schema and applies migrations once per test file. */
export async function setupDatabase(): Promise<DpDb> {
  if (!TEST_DB_URL) throw new Error("DEALPILOT_TEST_DATABASE_URL is not set");
  const { db, pool } = createDb(TEST_DB_URL, { max: 5 });
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await runMigrations(db);
  await seedSampleCatalog(db);
  shared = { db, end: () => pool.end() };
  return db;
}

export async function teardownDatabase() {
  await shared?.end();
  shared = null;
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig({ NODE_ENV: "test", DATABASE_URL: TEST_DB_URL ?? "postgres://unused", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123", DEALPILOT_APP_URL: ORIGIN }),
    ...overrides,
  };
}

export function buildApp(db: DpDb, analyst: AnalystProvider = new DemoAnalyst(), config = testConfig()) {
  return createApp({ db, auth: createAuth(db, config), config, analyst });
}

export type Agent = ReturnType<typeof request.agent>;

/** Signs up a fresh user and returns a cookie-carrying agent. */
export async function signUp(app: ReturnType<typeof buildApp>, email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", ORIGIN)
    .send({ email, password: "correct-horse-battery", name: email.split("@")[0] });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const json = (agent: Agent) => ({
  get: (url: string) => agent.get(url).set("Origin", ORIGIN),
  post: (url: string, body?: object) => agent.post(url).set("Origin", ORIGIN).send(body ?? {}),
  put: (url: string, body: object) => agent.put(url).set("Origin", ORIGIN).send(body),
  patch: (url: string, body: object) => agent.patch(url).set("Origin", ORIGIN).send(body),
  delete: (url: string, body?: object) => agent.delete(url).set("Origin", ORIGIN).send(body ?? {}),
});

/** Supertest parser that buffers binary responses. */
export function binaryParser(res: unknown, cb: (err: Error | null, body: Buffer) => void) {
  const stream = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on("data", (c: Buffer) => chunks.push(c));
  stream.on("end", () => cb(null, Buffer.concat(chunks)));
}
