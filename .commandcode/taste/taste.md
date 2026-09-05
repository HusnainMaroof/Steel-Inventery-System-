# Taste

## Framework & dependencies
- Prefers using the latest stable major version of frameworks (e.g. Next.js 16 over Next.js 15), not older versions. Confidence: 0.6
- Prefers the modern flat ESLint config style (`eslint-config-next/core-web-vitals` / `/typescript`) over the legacy `FlatCompat` wrapper when on Next.js 16. Confidence: 0.5

## Workflow & verification
- When asked to check for errors, wants a comprehensive project-wide review covering compile/type errors, UI issues, and routing — not just a fix for the single reported bug. Confidence: 0.7
- Expects fixes to be verified by actually running the app (full build + serving every route and confirming HTTP 200) rather than stopping at a clean typecheck/lint. Confidence: 0.7