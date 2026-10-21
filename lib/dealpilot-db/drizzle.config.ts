import { defineConfig } from "drizzle-kit";
import path from "path";

// `generate` only diffs the schema against existing migrations, so no database
// connection is needed. Apply migrations with `pnpm --filter @workspace/dealpilot-db run migrate`.
export default defineConfig({
  schema: path.join(__dirname, "./src/schema.ts"),
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
});
