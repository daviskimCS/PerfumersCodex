import 'dotenv/config'
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
