# bloom-portal — Production Admin Command Center

**Domain:** portal.edubloom.com.ng
**Repo:** bloom-portal
**Last updated:** 2026-08-20

---

## App Overview

Vanilla JS/HTML PWA. Bayo's admin dashboard — approve deals, manage agents,
track commissions, CAC fund, opportunities, school status.
Real Firebase Auth (email/password). 8-hour session timeout.
Firestore password fallback for offline resilience.

---

## Current Versions

| File | Version |
|------|---------|
| portal_app.js | `?v=20260820-security` |
| sw.js CACHE_NAME | `edubloom-bloom-portal-20260820-security` |

---

## Session History

### 2026-08-20 — Production Security Audit

**XSS fix — portal_app.js line 156:**
Calendar state dropdown populated via `.states.map(s => option value="${s}")` without
escaping. Bayo controls Firestore writes here so real-world risk is low, but fixed
for hygiene and defence-in-depth. Now uses `esc(s)` in both value and text.

**Cache bump:** `?v=20260820-security` | sw.js CACHE_NAME bumped to match

**Firestore rules:** Correctly published Aug 19, 2026. No changes needed.

---

### 2026-08-18 — Auth Hotfix

Firebase Auth + Firestore password fallback added.
8-hour session timeout implemented (ad_auth_time in localStorage).
Payment status tracking on approved schools. Calendar tab added.

---

## Login

Firebase Auth email/password → session stored in localStorage with timestamp.
Expires after 8 hours — re-login required.

## Key Collections Managed

| Collection | Portal Action |
|-----------|--------------|
| admin_deals | Review + approve / reject |
| admin_agents | Add / edit / delete / activate |
| admin_approved_schools | School records post-approval |
| admin_ledger | Commission entries (new 20%, renewal 10%) |
| admin_settings | Password, WhatsApp template, CAC setting |
| admin_cac | CAC Reactivation Fund tracker (target ₦250,000) |
| schools | Creates school login doc on approval |

## Approval Flow

1. Agent submits deal → `admin_deals` (status: pending)
2. Bayo approves → generates BLOOM-XXXXXX school ID
3. Creates `schools/{schoolId}` doc via direct write (not queued — must succeed)
4. Adds commission entry to `admin_ledger`
5. Opens WhatsApp with school credentials

## Firestore Rules — CORRECTLY PUBLISHED ✅

Published Aug 19, 2026 at 7:10 AM. Rules are correct — no action needed.
`admin_approved_schools` is Bayo-only (contains every school password).
Run `repairSchool()` in portal for any school approved before the direct-write fix.
---

## Project Scope Document

`EDUBLOOM_PROJECT_SCOPE.md` in this repo is the master scope document.
It defines what is in scope, what is explicitly out of scope, the change order
process and pricing, and the acceptance criteria for all three apps.

Any feature request not listed in Section 2 of that document requires a formal
Change Order before work begins.
---

## Email Infrastructure

`EMAIL_INFRASTRUCTURE.md` in this repo covers:
- SPF + DKIM + DMARC DNS records for `pay.edubloom.com.ng` (Mailgun) and `hello.edubloom.com.ng` (Brevo)
- Sending domain split — transactional vs marketing fully isolated
- Delivery monitoring: Google Postmaster Tools, Mailgun Analytics, MXToolbox, Mail-Tester
- Deploy checklist before going live with email receipts
- Firebase secrets required: PAYSTACK_SECRET_KEY, MAILGUN_API_KEY
---

## WhatsApp Receipt Setup

`WHATSAPP_SETUP.md` in this repo is the step-by-step guide for setting up
Termii WhatsApp Business API so BloomCollect sends automatic payment receipts
to parents via WhatsApp. Includes everything Bayo needs to do, costs, and timelines.
