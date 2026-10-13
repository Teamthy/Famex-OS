# Operating Cost Estimate (Nigeria)

A concrete, itemised estimate of what it costs to *run* the EduPortal platform
yearly in Nigeria. Prices are 2026 published rates and will drift — treat the
Naira figures as a planning range, not a quote. The USD→₦ conversion assumes
roughly **₦1,450/USD** (the rate moves; re-check before budgeting).

There are two honest deployment paths. They cost very differently and buy very
different things.

---

## Path A — Managed / serverless (zero-ops, recommended)

The app runs on managed services. You write no infra, patch nothing, and get
SLA-level reliability for free. Best choice when you do **not** want to be on
call.

| Service | What it does here | Monthly ≈ USD |
|---|---|---|
| **Vercel** (Pro) | Next.js hosting, SSR + the 130 API routes | $20 |
| **Neon Postgres** (Launch) | Database, ~10 GB, ~1K DAU | $15–25 |
| **Upstash Redis** | Rate limiting | $0–2 |
| **Cloudflare R2** | Admission documents + APK (89 MB) | $0 (10 GB free) |
| **Resend** | Emails (welcome, results, alerts) | $0–20 (3K/mo free) |
| **Sentry** | Error/crash tracking | $0 (free tier) |
| **Domain** (.ng / .com.ng) | Public site + links | $3–6 (amortized) |
| **Subtotal** | | **≈ $38–73 / mo** |

**≈ $500–850 / year ≈ ₦700K–1.2M / year.**

### Paystack (add-on, variable)
Nigeria gets an **education rate: 0.7%, capped at ₦1,500 per local-card
transaction** (vs the standard 1.5% + ₦100). This scales with how much school
fee money flows through the portal:

- ~₦20M/yr collected → ~₦140K/yr
- ~₦100M/yr collected → ~₦700K/yr

Transfers/refunds incur fixed ₦10–50 per transfer.

---

## Path B — Self-hosted on a Nigerian VPS (cheapest, most ops)

One 4 GB VPS (e.g. Vultr Lagos, or a Contabo box) running Postgres + Redis +
the Docker image (the repo ships a production `Dockerfile` + `docker-compose.yml`).

| Item | Monthly ≈ USD |
|---|---|
| 4 GB VPS (Lagos / nearby) | $12–24 |
| Domain | $3–6 |
| **Subtotal** | **≈ $15–30 / mo** |

**≈ $180–360 / year ≈ ₦270K–540K / year.**

The same app at roughly **half the cost, and lower latency** for parents in
Lagos (no serverless cold starts, data stays in-country). The trade is real:
**you are the on-call engineer** — backups, TLS, security patching, uptime, and
(if hosted on-premise) generator/UPS. For a school that cannot babysit a server,
Path A is almost always worth the difference.

---

## What changes as the school grows

| DAU | Driver | Cost note |
|---|---|---|
| 100–1,000 | Free tiers + Vercel Hobby/Pro | Covered by the ranges above |
| ~2,500 | DB load, more email | Neon + Resend rise a few $; still Path A ranges |
| 5,000–10,000 | Read replicas, durable notification queue, CDN | Path A climbs to ~$80–150/mo; Path B needs 2–3 VPS |

---

## Cost levers already in the codebase

- **Rate limiting falls back to in-memory** when Redis is unset — you can ship on
  Path B with zero Redis spend (at the cost of per-instance throttling only).
- **R2 free tier covers the APK** (89 MB) and admission documents — no storage
  bill until you exceed 10 GB.
- **Resend's 3,000 free emails/mo** covers welcome + results for a small school.
- **Sentry free tier** covers error tracking at 1K DAU.

## Verdict

A realistic annual infra budget for a 1K-DAU school in Nigeria:

> **₦500K–1.2M / year** for infrastructure only (excluding Paystack fees),
> with the managed stack at ~₦700K–900K being the sensible default and
> self-hosting on a Lagos VPS the budget option at ~₦300–500K if you're
> willing to own the operations.

Re-check three things before committing: the current **USD→₦ rate**, current
**Vercel/Neon** pricing, and whether the school's **Paystack education rate**
(0.7%) is applied to the account.
