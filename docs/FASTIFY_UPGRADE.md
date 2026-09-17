# Fastify Security Advisory — Upgrade Plan

## Current state

| Package | Version |
|---------|---------|
| `@nestjs/platform-fastify` | ^11.0.0 |
| `fastify` (transitive) | ≤5.12.0 |

## Advisories (npm audit)

1. **GHSA-w2qp-rph6-63g4** (moderate) — Schema validation bypass via root primitive coercion mismatch.
2. **GHSA-3m5p-2c4r-xxw2** (moderate) — `X-Forwarded-*` spoofing under `trustProxy` hop-count.

`npm audit fix --force` proposes `@nestjs/platform-fastify@12.0.3` — a **breaking major upgrade**.

## Exposure assessment

| Advisory | Tradex exposure | Mitigation in place |
|----------|-----------------|---------------------|
| Schema bypass | Low — request bodies validated by Nest `ValidationPipe` + class-validator DTOs before Fastify schema layer | DTO validation on all controllers |
| X-Forwarded spoofing | Medium only if `TRUST_PROXY=1` behind an untrusted proxy | `TRUST_PROXY` is opt-in; use only behind known Nginx/reverse proxy |

## Target upgrade path

| | |
|---|---|
| **Target** | `@nestjs/platform-fastify@12.x`, Fastify 5.x |
| **Nest core** | Likely `@nestjs/common@12`, `@nestjs/core@12` together |

## Breaking changes to expect

- Fastify 5 plugin API changes
- NestJS 12 peer dependency alignment
- Possible `@fastify/helmet`, `@fastify/multipart` version bumps
- `main.ts` bootstrap / adapter registration may need updates

## Required code changes (checklist)

- [ ] Upgrade all `@nestjs/*` packages to 12.x in lockstep
- [ ] Run `npm audit` after upgrade
- [ ] Update `server/src/main.ts` for any Fastify 5 registration changes
- [ ] Verify multipart uploads (`media` module)
- [ ] Verify helmet / CORS / trust proxy settings
- [ ] Run full test suite + `production-hardening.mjs` + `e2e-simulation.mjs`

## Testing requirements

1. `npm test` — all unit tests
2. `npm run build`
3. `node scripts/security-fixes-test.mjs`
4. `node scripts/production-hardening.mjs`
5. `node scripts/e2e-simulation.mjs`
6. Manual: login, bootstrap, sale create, payment, report export

## Recommendation

**Do not upgrade during a feature release.** Schedule a dedicated dependency sprint. Until then, treat Fastify advisories as **known moderate risk** with documented mitigations.

## Status

**NOT RESOLVED** — documented known risk with mitigations.
