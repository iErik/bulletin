import { defineConfig } from 'drizzle-kit'

// `pnpm db:generate` writes a migration for schema
// changes. The app applies them at startup.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/backend/storage/schema.ts',
  out: './src/backend/storage/migrations'
})
