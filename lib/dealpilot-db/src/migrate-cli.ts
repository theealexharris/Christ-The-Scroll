import { createDb, runMigrations } from "./index";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be set to run migrations.");
  process.exit(1);
}
const { db, pool } = createDb(url, { max: 1 });
await runMigrations(db);
await pool.end();
console.log("DealPilot migrations applied.");
