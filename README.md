# bloom-portal — Production Admin Command Center

**Domain:** portal.edubloom.com.ng
**Repo:** bloom-portal
**Last updated:** 2026-08-24

---

## Second Brain

`PROJECT_STATE.md` in this repo is the master project state document.
Read it at the start of every Claude session before touching any code.
It contains architecture, credentials, all 6 repo versions, pending actions,
standing rules, session history, and the full picture of what is in sandbox
vs production.

---

## App Overview

Vanilla JS/HTML PWA. Bayo's admin dashboard — approve deals, manage agents,
track commissions, CAC fund, opportunities, school status.
Real Firebase Auth (email/password). 8-hour session timeout.

---

## Current Versions

| File | Version |
|------|---------|
| portal_app.js | `?v=20260820-security` |
| sw.js CACHE_NAME | `edubloom-bloom-portal-20260820-security` |

---

## Documents in This Repo

| File | Purpose |
|------|---------|
| PROJECT_STATE.md | Second brain — read this first every session |
| EDUBLOOM_PROJECT_SCOPE.md | Scope, out-of-scope (16 categories), change orders + pricing, 50 acceptance criteria |
| EMAIL_INFRASTRUCTURE.md | SPF/DKIM/DMARC for pay + hello domains, Resend + Brevo, delivery monitoring |
| WHATSAPP_SETUP.md | 8-step Termii WhatsApp Business API setup, ₦6,500 total |
| SECURITY_QUESTIONNAIRE.md | Security posture Q&A |

---

## Session History

### 2026-08-20 — Security audit + compliance session

XSS fix: esc(s) in calendar dropdown option tags.
Cache bumped to 20260820-security.
Documents created: PROJECT_SCOPE, EMAIL_INFRASTRUCTURE, WHATSAPP_SETUP.

---

## Approval Flow

Agent submits deal → Bayo approves → BLOOM-XXXXXX generated
→ school doc created in Firestore → commission logged → WhatsApp credentials sent

## Standing Notes

- Firestore rules published Aug 19, 2026 — correct, no changes needed
- admin_approved_schools is Bayo-only (contains every school password)
- Full project state: PROJECT_STATE.md (this repo)
