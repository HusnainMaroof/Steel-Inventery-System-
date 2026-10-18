import { config } from "dotenv";

// `npm run start:dev` uses the test database (.env.e2e).
// `npm run start:prod` (and any other start) uses the main database (.env).
const envFile =
  process.env.npm_lifecycle_event === "start:dev" ? ".env.e2e" : ".env";

config({ path: envFile, quiet: true });
