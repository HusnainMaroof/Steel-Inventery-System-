import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**"]),
  {
    rules: {
      // The app syncs URL params, caches, and dialog state in effects.
      // Keep the findings in CI output without failing the job on that existing pattern.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);