# EduBloom — Project State (Second Brain)
**AariNAT Company Limited | RC-1732521 | Bayo Adesanya**
**Last updated:** 2026-08-24

---

## HOW TO USE THIS FILE

This is the first thing Claude reads at the start of every EduBloom session.
It contains everything — architecture, credentials, current versions, what is in
sandbox vs production, pending actions, standing rules, and session history.

**At session start:** Claude fetches this file from GitHub and reads it fully before
touching any code. No re-explaining needed.

**At session end:** Claude pushes an updated version of this file reflecting everything
that changed in the session.

**Standing instruction:** Always read
`https://github.com/KobOmoba/bloom-portal/blob/main/PROJECT_STATE.md`
before beginning any EduBloom development work.

---

## 1. Architecture

Three-app SaaS suite for Nigerian private schools.
All three apps: vanilla HTML + CSS + JavaScript. No frameworks. No build tools.
Deployment: GitHub Pages via KobOmoba account.
Backend: Google Firebase Firestore (single project, shared by all six repos).
All apps are offline-first PWAs with service worker caching.

```
bloom-agent    → agent.edubloom.com.ng    → Field agents submit school deals
bloom-portal   → portal.edubloom.com.ng   → Bayo's admin command center
School-Bloom   → school.edubloom.com.ng   → Schools manage everything
```

Each production app has a sandbox repo:

```
bloom-agent-v2   → sandbox for bloom-agent
bloom-portal-v2  → sandbox for bloom-portal
school-bloom-v2  → sandbox for School-Bloom
```

Sandbox-first rule: ALL new features proved in sandbox before production port.
Never push to production simultaneously with sandbox unless explicitly instructed.

---

## 2. Credentials

### GitHub
Account: KobOmoba
Active token: stored in Claude project memory (userMemories) — retrieve from there, never hardcode in files
Dead tokens: stored in Claude project memory — do not use

### Firebase
Project ID: `educationbloom-699ed`
API Key: `AIzaSyCVEdunn3AZndDP5Rm1Z3Kv1e6G6W2mB_o`
Auth Domain: `educationbloom-699ed.firebaseapp.com`
App ID: `1:33750392965:web:2b3da887ede996ea8389ec`
Bayo's Auth UID: `HSpdm2NYK4hEGqBxyTPEi2wy39F2`
Bayo's email: `adebayoadesanya423@gmail.com`

### Contact
WhatsApp/Phone: +234 814 507 3941
Email: aarinat.company.limited@gmail.com

---

## 3. Current Versions — All 6 Repos

| Repo | index.html ?v= | sw.js CACHE_NAME |
|------|---------------|-----------------|
| bloom-agent | 20260820-security | edubloom-bloom-agent-20260820-security |
| bloom-portal | 20260820-security | edubloom-bloom-portal-20260820-security |
| **School-Bloom** | **20260823c** | **edubloom-School-Bloom-20260823c** |
| bloom-agent-v2 | 20260820-security | edubloom-bloom-agent-v2-20260820-security |
| bloom-portal-v2 | 20260820-security | edubloom-bloom-portal-v2-20260820-security |
| school-bloom-v2 | 20260820-email-receipts | edubloom-school-bloom-v2-20260820-email-receipts |

Note: School-Bloom production is ahead of all other repos due to direct production
commits by Bayo on 2026-08-22, 23, 24. See Section 9 for details.

---

## 4. Repo → Domain → Files

| Repo | Domain | JS file | HTML |
|------|--------|---------|------|
| bloom-agent | agent.edubloom.com.ng | app.js | index.html |
| bloom-portal | portal.edubloom.com.ng | portal_app.js | index.html |
| School-Bloom | school.edubloom.com.ng | app.js | index.html |
| edubloom-website | edubloom.com.ng | — | index.html |

---

## 5. Firestore Rules — PUBLISHED AND CORRECT

Published: **Aug 19, 2026 at 7:10 AM** in Firebase Console.
Status: Correct. No changes needed.

Note on testing: `firestore.googleapis.com` is not reachable from Claude's container
(blocked by network egress proxy). Any 403 errors seen in Claude's pentest tool are
Claude's network block, NOT Firebase rule failures. Apps work correctly.
Run pentest from GitHub Actions for accurate results.

| Collection | Access |
|-----------|--------|
| admin_agents | public read, Bayo-only write |
| admin_deals | public read + create, Bayo-only update/delete |
| admin_ledger | public read, Bayo-only write |
| public_ocr_keys | public read, Bayo-only write |
| admin_opportunities | public read, Bayo-only write |
| admin_agent_requests | public create, Bayo-only read/update/delete |
| admin_alerts | public create, Bayo-only read/update/delete |
| admin_settings | Bayo-only |
| admin_cac | Bayo-only |
| admin_activity | Bayo-only |
| admin_approved_schools | Bayo-only (contains every school password) |
| schools/{schoolId} | open read/write (per-school auth deferred — own project) |

---

## 6. Business Rules

### Commission Structure
| Type | Rate | Who |
|------|------|-----|
| New school (closing agent) | 20% of term fee | Permanent |
| Renewal (original closer) | 10% of term fee | Permanent, every renewal |
| Senior Agent (Stage 4+) | 5% override on junior sales | Not yet active |

### Pricing Tiers
| Students | Fee/term |
|----------|----------|
| 1–50 | ₦10,000 |
| 51–100 | ₦20,000 |
| 101–200 | ₦35,000 |
| 201–350 | ₦55,000 |
| 351+ | ₦75,000 |

### BloomCollect Fee Model (Option B — confirmed 2026-08-12)
- Parent pays: school_fee + 2.5% (1.5% Paystack gateway + 1% AariNAT)
- School receives: exact school_fee
- AariNAT nets: ~1% after gateway costs
- Payment provider: Paystack (switched from Kora 2026-08-12)

### Plan Tiers
| Plan | Features |
|------|---------|
| Basic | All standard features |
| Premium | BloomCollect + Safety features (F1/F2/F3) |

---

## 7. RBAC — School Portal Roles

| Role | Tabs accessible | Fee data | Health data |
|------|----------------|----------|-------------|
| Principal | All 16+ tabs | ✅ | ✅ (vault unlock required) |
| Bursar | revenue, students, expenses, finance, analytics, settings, support, opps | ✅ | ❌ |
| Class Teacher | students (own class), sports, arts, music, health, alumni, scorecard, comms, opps | ❌ | ❌ |
| Subject Teacher | students, scorecard, opps | ❌ | ❌ |

Note: Health tab — Class Teacher sees the tab but gets a "Principal only" block message.

---

## 8. OCR Configuration (Proven, Do Not Change)

Primary: Groq Vision — model `qwen/qwen3.6-27b`, 800px image resize,
  `max_tokens: 4096`, `reasoning_format: "hidden"` (NOT `reasoning_effort`)
Fallback: HuggingFace — `Qwen2.5-VL-7B-Instruct`
Last resort: OCR.space — Engine 3 → Engine 2, `apikey=helloworld`

Keys stored in Firestore `public_ocr_keys/main` (synced by portal's `syncOcrKeysToPublic()`).
bloom-agent reads `public_ocr_keys/main` directly — no proxy.
Strip `<think>...</think>` tokens before JSON parsing regardless of model.
15-second inter-page cooldowns for Groq free-tier TPM limits.

---

## 9. What Is In Production vs Sandbox

### In Production (All Three Live Apps) ✅

**bloom-agent:**
- Offline-first deal submission with SQ sync queue
- Phone number login (Firestore lookup, no Firebase Auth)
- OCR student register counter (Groq/HF/OCR.space)
- Commission calculator
- Deal history + earnings tabs
- XSS fix: esc(n) on OCR name list (pushed 2026-08-20)

**bloom-portal:**
- Firebase Auth login with 8-hour session timeout
- Real-time pending deal listener
- School approval → BLOOM-XXXXXX ID generation
- Agent management (add/edit/delete/activate)
- Commission ledger with mark-paid
- CAC Reactivation Fund tracker (target ₦250,000)
- Opportunities board
- XSS fix: esc(s) in calendar dropdown (pushed 2026-08-20)

**School-Bloom (most recently updated — version 20260823c):**
- Full RBAC 4-role login
- Student management (add/import CSV/photo OCR)
- Fee collection + bulk payment CSV import
- WhatsApp fee reminders
- Attendance (14-day, with correction)
- Scores (per-term CA+exam, bulk entry grid)
- Broadsheet/scorecard with rankings
- Report cards (individual + batch)
- End-of-term wizard
- Expenses + Finance
- Staff management with role assignment
- Sports, Arts, Music tabs
- Alumni tracking
- Communications log
- Opportunities display
- Settings tab
- Safety features (F1 absence alert, F2 collector list, F3 sign-out) — Premium
- Demo mode
- XSS fix: esc(name/userRole/classInfo) in bannerEl (2026-08-20)
- Structural HTML fix: removed premature </body></html> at line 1329 (2026-08-20)
- Syntax repairs (2026-08-22 / 23): lesson note generation, questions, apostrophes
- Lessons dropdown fix: Class/Subject selects always repopulate (2026-08-23)
- SW fix: CDN URLs removed from SHELL_ASSETS — install no longer fails offline (2026-08-24)
- Firebase fix: AutoDetectLongPolling instead of experimentalForceLongPolling (2026-08-24)
- Firestore ping: probes Firestore directly, not navigator.onLine (fixes Nigerian 4G false offline)
- Auto-reload on new SW via SW_UPDATED + controllerchange

### In Sandbox Only — NOT Yet in Production ⏳

**school-bloom-v2:**

1. **Health Data Compliance Module** (built 2026-08-20)
   - AES-256-GCM field encryption via Web Crypto API
   - PBKDF2 key derivation from school password + schoolId
   - Key lives in memory only (_healthKey) — never persisted
   - Fields encrypted: studentName, type, action, notes
   - Principal-only RBAC gate + vault unlock step
   - Audit logging to admin_activity on every read/write/delete
   - Groq/HF OCR blocked from health data (manual entry only)
   - See: school-bloom-v2/HEALTH_DATA_COMPLIANCE.md

2. **BloomCollect WhatsApp Receipts** (built 2026-08-20)
   - school-bloom-v2/functions/bloomcollect.js
   - sendWhatsAppReceipt() via Termii WhatsApp Business API — PRIMARY
   - sendPaymentReceipt() via Resend email — BACKUP
   - Failure logging to admin_whatsapp_failures / admin_email_failures
   - Paystack provider (not Kora — confirmed 2026-08-12)

---

## 10. Pending Actions — Bayo Must Do These (Cannot Be Done in Code)

### URGENT — WhatsApp Receipts (before BloomCollect can go live)
See full instructions: `bloom-portal/WHATSAPP_SETUP.md`
Total cost: ₦6,500 | Active time: ~4 hours | Calendar: 3–5 days

| # | Action | Where | Cost |
|---|--------|-------|------|
| 1 | Buy dedicated EduBloom SIM | Any outlet | ₦1,500 |
| 2 | Create Meta Business Account | business.facebook.com | Free |
| 3 | Create Termii account + KYC | termii.com | Free |
| 4 | Connect WhatsApp number via Termii | Termii dashboard | Free |
| 5 | Submit bloomcollect_receipt template to Meta | Via Termii | Free |
| 6 | Fund Termii wallet | Termii billing | ₦5,000 |
| 7 | Set Firebase secrets (TERMII_API_KEY, TERMII_DEVICE_ID, TERMII_TEMPLATE_ID, PAYSTACK_SECRET_KEY, RESEND_API_KEY) | Firebase CLI | Free |
| 8 | Deploy Cloud Function | Firebase CLI | Free |

### HEALTH DATA — Legal Compliance
- [ ] Sign Google Cloud DPA/BAA at cloud.google.com/terms/health (for Firebase health data storage)
- [ ] Register AariNAT as a Data Processor with NDPC (ndpc.gov.ng)

### DNS — Email Infrastructure
See full instructions: `bloom-portal/EMAIL_INFRASTRUCTURE.md`
- [ ] Add SPF + DKIM + DMARC + CNAME records for `pay.edubloom.com.ng` (Resend)
- [ ] Add SPF + DKIM + DMARC + CNAME records for `hello.edubloom.com.ng` (Brevo)
- [ ] Verify domains in Resend and Brevo dashboards
- [ ] Set up Google Postmaster Tools for both domains

### PRODUCTION PORTS — Awaiting Explicit Go-Ahead
- [ ] Port health compliance module from school-bloom-v2 to School-Bloom
- [ ] Port BloomCollect WhatsApp receipts to School-Bloom (after WhatsApp setup complete)
- [ ] Backport School-Bloom Aug 22/23/24 fixes to school-bloom-v2 (sandbox is behind)

---

## 11. Documents Index (bloom-portal repo)

| File | What it covers |
|------|---------------|
| EDUBLOOM_PROJECT_SCOPE.md | In scope, out of scope (16 categories), change order process + pricing, 50 acceptance criteria |
| EMAIL_INFRASTRUCTURE.md | SPF/DKIM/DMARC records for pay + hello domains, Resend + Brevo setup, delivery monitoring |
| WHATSAPP_SETUP.md | 8-step guide for Termii WhatsApp Business API setup, ₦6,500 total |
| SECURITY_QUESTIONNAIRE.md | Security posture questions and answers |
| PROJECT_STATE.md | This file — the second brain |

| File | Repo | What it covers |
|------|------|---------------|
| HEALTH_DATA_COMPLIANCE.md | school-bloom-v2 | NDPA 2023 compliance, AES-256 encryption spec, BAA/DPA requirements |

---

## 12. Standing Rules — Non-Negotiable

**Sandbox-first:** All new features built in sandbox repos first.
Never push to production without explicit Bayo go-ahead.

**README after every push:** After every push to ANY repo, update that repo's README.md
in the same session. No exceptions. For bloom-agent-v2, README update must be in the
same push as any other work.

**Cache-bust both files together:** Bump `?v=YYYYMMDD-descriptor` in index.html AND
`CACHE_NAME` in sw.js in the same push. Never one without the other.

**Syntax gate:** Run `node --check file.js` before pushing any app.js or portal_app.js.
Exception: School-Bloom/app.js has a pre-existing browser-only template literal at
line ~10030 that node rejects — this file is excluded from the syntax gate.
Push it without the check, document this fact.

**Port code verbatim:** When porting between repos, copy exactly — no silent improvements,
no unrequested changes. If a real bug is found, fix it and document the specific discrepancy.

**No Base44 / Koda:** Removed entirely from all apps (2026-07-25). Never reintroduce.

**No auth changes without explicit instruction:** On 2026-07-25, an unauthorized auth
change locked Bayo out of production. This was reverted. Never touch login/auth
code without explicit instruction.

**_isPremium() hardcoded true:** Returns true in both School-Bloom (production) and
school-bloom-v2 (sandbox). TEMP BYPASS — do not relock without Bayo's explicit go-ahead.
If one gets relocked, ask whether the other should too — never assume.

**Firestore rules:** Published by Bayo directly in Firebase Console. Claude documents
gaps in README and provides rule text for Bayo to paste. Claude never edits rules directly.

**WhatsApp for password recovery:** Routes to Bayo (+234 814 507 3941) directly.
Never to agents.

---

## 13. Known Gaps and Deferred Items

**Per-school Firebase Auth:** The `schools` collection is intentionally open (allow read, write: if true).
Locking it down properly requires a real per-school Firebase Auth identity system.
Deferred as its own project. Do not rush a same-session fix.

**BloomCollect Cloud Functions:** Written and in school-bloom-v2/functions/bloomcollect.js.
Not yet deployed to production. Blocked on Bayo completing the 8 Termii/Paystack steps.

**Pentest CI (school-bloom-v2):** pentest-ci.js, SECURITY.md, security.html, GitHub Actions
not yet added to school-bloom-v2. In bloom-agent-v2 and bloom-portal-v2 only.

**school-bloom-v2 behind production:** School-Bloom had 10+ direct-to-production commits
on Aug 22/23/24 (syntax repairs, SW fixes, Firebase fixes). school-bloom-v2 does not have
these. Backport pending.

**Tier enforcement in School-Bloom:** When student count exceeds purchased tier, a banner
shows and the app locks after 3 days grace period. Working in production. Not yet in sandbox.

---

## 14. Session Log

### 2026-08-24 — PROJECT_STATE.md created (this session)
Created the second brain. Captured all state from all sessions.

### 2026-08-24 — School-Bloom production direct fixes (by Bayo)
SW fix: CDN URLs removed from SHELL_ASSETS (install now works offline).
Firebase fix: AutoDetectLongPolling replaces experimentalForceLongPolling.
Firestore ping fix: probes Firestore directly, not navigator.onLine.
Auto-reload on new SW via SW_UPDATED + controllerchange.
Cache bumped to 20260823c.
README NOT updated for these commits — needs update.

### 2026-08-23 — School-Bloom production direct fixes (by Bayo)
Multiple syntax repairs (lesson note, questions, apostrophes, template literals).
Lessons dropdown fix: Class/Subject selects always repopulate.
SW auto-reload notification added.
Cache bumped to 20260823-makeover / 20260823b-fix.
README updated for Aug 23 batch.

### 2026-08-20 — Security audit + compliance session (Claude)
PRODUCTION fixes (direct on Bayo's instruction):
- bloom-agent: esc(n) on OCR list; cache 20260820-security
- bloom-portal: esc(s) in calendar dropdown; cache 20260820-security
- School-Bloom: removed premature </body></html> (line 1329); esc(name/userRole/classInfo);
  cache 20260820-security (later superseded by Bayo's Aug 23 commits)

SANDBOX builds:
- school-bloom-v2: health compliance module (AES-256-GCM, Principal-only, audit logging)
- school-bloom-v2/functions/bloomcollect.js: WhatsApp receipt via Termii + email via Resend
- bloom-portal-v2: esc(s) backported; cache 20260820-security
- bloom-agent-v2: cache 20260820-security (esc(n) already done earlier this session)

DOCUMENTS created:
- bloom-portal/EDUBLOOM_PROJECT_SCOPE.md (scope, out-of-scope, change orders, 50 AC)
- bloom-portal/EMAIL_INFRASTRUCTURE.md (SPF/DKIM/DMARC, Resend + Brevo)
- bloom-portal/WHATSAPP_SETUP.md (8-step Termii guide, ₦6,500)
- school-bloom-v2/HEALTH_DATA_COMPLIANCE.md (NDPA 2023, BAA/DPA requirements)
- /mnt/user-data/outputs/BloomCollect_WhatsApp_Setup.docx (Word version of setup guide)

### 2026-08-19 — Firestore rules hardened (by Bayo in Firebase Console)
Rules published at 7:10 AM. Correct and confirmed.
admin_settings, admin_cac, admin_activity, admin_approved_schools locked to Bayo UID.
admin_agents, admin_deals, admin_ledger, public_ocr_keys — public read.
schools/{schoolId} — open (per-school auth deferred).
V2 subcollection rules (staff_directory, students, scores) ready for future auth project.

### Earlier sessions (pre-2026-08-20)
- Base44/Koda removed from all apps (2026-07-25) after unauthorized auth change
- Security audit: XSS fixes (esc() on innerHTML), structural HTML bugs fixed
- Production security rules: 23/23 checks passing, 18/18 sandbox checks passing
- Health data compliance module (AES-256-GCM) first built
- Payment provider confirmed as Paystack (switched from Kora 2026-08-12)
- _isPremium() hardcoded true in both School-Bloom and school-bloom-v2

---

## 15. How to Start the Next Session

1. Read this file (you are doing that now)
2. Check if School-Bloom README needs updating (Aug 24 commits have no README)
3. Check if school-bloom-v2 needs backporting (behind School-Bloom production)
4. Ask Bayo what to work on
5. At end of session: update this file and push to bloom-portal/PROJECT_STATE.md
