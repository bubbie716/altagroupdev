# Daily servicing cron

Alta’s once-daily banking job runs at `/api/cron/daily-servicing`. It must be installed as a separate HTTP cron from the every-minute scheduled-transfers job.

## Required timer

| Field | Value |
|-------|--------|
| **Endpoint** | `/api/cron/daily-servicing` |
| **Methods** | `GET` or `POST` |
| **Schedule** | Once daily (recommended **06:00 UTC**) |
| **Auth** | `Authorization: Bearer <CRON_SECRET>` (preferred) or `?secret=<CRON_SECRET>` |
| **Timeout** | Allow at least **30 seconds** |

Point any reliable scheduler (cron-job.org, systemd timer on a Mini-PC, etc.) at your deployed host. Do **not** bundle this work into `/api/cron/scheduled-transfers` — daily work can exceed a 30-second transfer poll.

## What it runs

In parallel sub-jobs:

1. **Loan servicing** — interest / auto-pay
2. **Alta Card** — statement + billing schedulers
3. **Bank statements** — monthly statement generation
4. **Deposit interest** — interest accrual
5. **Commercial Pro billing** — renewals, past-due, grace downgrade, admin-grant expiration, scheduled customer downgrades

The commercial billing sub-job (`commercial-pro-billing`) includes:

- Pro subscription renewals / charges
- Past-due marking and renewal reminders
- Grace-period downgrade to Core
- Admin-grant expiration
- Customer-scheduled Pro → Core downgrades (payroll cancelled; existing invoices and payment links remain valid; Core creation limits apply afterward)

## Response shape

Successful run (not skipped):

```json
{
  "skipped": false,
  "ok": true,
  "partialFailures": false,
  "errors": [],
  "loanServicing": { "...": "..." },
  "altaCard": { "statements": { "...": "..." }, "billing": { "...": "..." } },
  "bankStatements": { "...": "..." },
  "depositInterest": { "...": "..." },
  "commercialBilling": {
    "ok": true,
    "processedCount": 0,
    "billedCount": 0,
    "failedCount": 0,
    "downgradedCount": 0,
    "remindersSent": 0,
    "pastDueMarked": 0,
    "scheduledDowngradesApplied": 0,
    "adminGrantsExpired": 0,
    "failures": []
  }
}
```

Idempotent skip after a successful UTC-day run:

```json
{
  "skipped": true,
  "skipReason": "..."
}
```

`ok: false` with `partialFailures: true` means one or more sub-jobs returned an error string; inspect `errors` and the corresponding sub-job payload.

## Manual test (non-production)

Never run exploratory curls against production from a local laptop unless ops explicitly asks.

```bash
# Staging / local only — replace host and secret
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://STAGING_HOST/api/cron/daily-servicing" | jq .
```

Expect HTTP 200 and JSON with `ok: true` (or `skipped: true` if already completed today).

## Mini-PC / systemd example (documentation only)

Do **not** edit `/opt` from development tasks. Example unit + timer for a dedicated Mini-PC runner:

`/etc/systemd/system/alta-daily-servicing.service`

```ini
[Unit]
Description=Alta daily servicing cron
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=CRON_SECRET=replace-me
Environment=ALTA_CRON_BASE_URL=https://YOUR_DOMAIN
ExecStart=/usr/bin/curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
  "${ALTA_CRON_BASE_URL}/api/cron/daily-servicing"
```

`/etc/systemd/system/alta-daily-servicing.timer`

```ini
[Unit]
Description=Run Alta daily servicing once per day

[Timer]
OnCalendar=*-*-* 06:00:00 UTC
Persistent=true
Unit=alta-daily-servicing.service

[Install]
WantedBy=timers.target
```

Enable on the Mini-PC (ops runbook, not this repo):

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now alta-daily-servicing.timer
sudo systemctl list-timers | grep alta-daily
```

## Related

- [scheduled-transfers.md](../scheduled-transfers.md) — transfer + payroll executor and cron overview
- `src/routes/api/cron/daily-servicing.ts` — HTTP entry
- `src/server/commercial-pro-billing-job.service.ts` — commercial billing sub-job
