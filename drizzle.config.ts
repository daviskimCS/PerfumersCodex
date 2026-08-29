import { config } from 'dotenv'

// .env.local is where Next.js keeps local secrets, but dotenv's default entry
// point only reads .env — drizzle-kit would otherwise see an undefined
// DIRECT_URL and fail with a confusing connection error. Load .env.local
// first, then .env as a fallback for CI or a plain-.env setup.
config({ path: '.env.local' })
config()
import { defineConfig } from 'drizzle-kit'

// Migrations run against the DIRECT connection (port 5432).
// The app runtime uses the pooled connection — see lib/db/index.ts.
export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
})
