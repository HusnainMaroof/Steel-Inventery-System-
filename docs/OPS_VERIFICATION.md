# Operations Verification Checklist

Items that cannot be verified from the repository alone. Complete in your deployment environment.

## Backups

- [ ] PostgreSQL automated backups enabled (Neon PITR or `pg_dump` cron)
- [ ] Backup retention policy defined (minimum 30 days)
- [ ] Backup stored in separate region/account from primary DB

## Restore

- [ ] Restore drill performed at least once
- [ ] Time-to-restore documented
- [ ] Application reconnects correctly after restore

## Monitoring

- [ ] Health endpoint (`GET /health`) monitored
- [ ] Error rate / 5xx alerts configured
- [ ] Database connection pool / latency monitored
- [ ] Disk / memory alerts on application host

## Deployment

- [ ] Single-instance vs multi-instance documented
- [ ] If multi-instance: shared rate-limit store required (Redis or similar)
- [ ] `TRUST_PROXY=1` only when behind known reverse proxy
- [ ] `JWT_SECRET` rotated from development default
- [ ] `DATABASE_URL` uses SSL in production

## Logging

- [ ] Application logs collected centrally
- [ ] Audit log table retention policy defined
- [ ] No passwords/tokens in application logs (verify grep)

## Security

- [ ] TLS terminated at proxy or load balancer
- [ ] Admin credentials not using defaults
- [ ] Super-admin account access restricted

## Status

**NOT VERIFIED** — requires deployment/infrastructure verification.
