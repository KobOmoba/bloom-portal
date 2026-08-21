# bloom-portal — Production Admin Command Center

**Domain:** portal.edubloom.com.ng
**Repo:** bloom-portal
**Last updated:** 2026-08-20

---

## App Overview

Vanilla JS/HTML PWA. Bayo's admin dashboard for approving deals, managing agents,
tracking commissions, CAC fund, opportunities, and school status.
Uses real Firebase Auth (email/password). 8-hour session timeout.
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
- Calendar state names from Firestore were injected into `<option value="...">`
  without escaping — `states.map(s => \`<option value="${s}">${s}</option>\`)`
- Though Bayo controls Firestore writes for this collection (low real-world risk),
  still corrected for hygiene and defence-in-depth
- **Fix:** `<option value="${esc(s)}">${esc(s)}</option>`

**Cache bust:** `portal_app.js?v=20260820-security` | CACHE_NAME + sw.js bumped

**Firestore pentest findings (6 rule failures — shared Firebase project):**
See School-Bloom README for the correct rule text to paste into Firebase Console.

---

### 2026-08-18 — Hotfix

Firebase Auth + Firestore password fallback. Session timeout (8-hour) added.
Payment status tracking on approved schools. Calendar tab.

---

## Login

Firebase Auth email/password → admin session stored in localStorage with timestamp.
Session expires after 8 hours — re-login required.

## Key Collections Managed

| Collection | What Portal Does |
|-----------|-----------------|
| admin_deals | Review + approve/reject |
| admin_agents | Add/edit/delete/activate |
| admin_approved_schools | School records after approval |
| admin_ledger | Commission entries (new 20%, renewal 10%) |
| admin_settings | Password, WhatsApp template, CAC setting |
| admin_cac | CAC Reactivation Fund tracker (target ₦250,000) |
| schools | Creates school login doc on approval |

## Approval Flow

1. Agent submits deal → `admin_deals` (status: pending)
2. Bayo approves → generates BLOOM-XXXXXX school ID
3. Creates `schools/{schoolId}` doc (direct write, not queued)
4. Adds commission entry to `admin_ledger`
5. Sends WhatsApp credentials to principal

## Standing Notes

- Firestore rules require Bayo's auth for `admin_settings`, `admin_cac`, `admin_activity`, `admin_approved_schools`
- `admin_agents`, `admin_deals`, `admin_ledger` require open read (agent app depends on this)
- See Firestore rule text in School-Bloom README — paste into Firebase Console
