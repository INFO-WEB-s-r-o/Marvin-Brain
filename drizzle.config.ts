import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  // strict mode prompts for confirmation interactively; the docker `db-setup`
  // service has no TTY, so strict:true hangs the documented quickstart.
  strict: false,
  verbose: true,
})
