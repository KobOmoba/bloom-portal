## 2026-08-10 — Emergency password removed

The portal emergency password fallback (used briefly during the rules
incident to restore access) has been removed. Portal login now uses the
standard path only: `aarinat2024` checked against Firestore
`admin_settings/main.adminPassword` (with hardcoded `aarinat2024` as
the in-code fallback if Firestore is unreachable).

Emergency access mode is no longer present in the codebase.

---

# bloom-portal

## 📍 Current Position — 2026-08-10

### 🔴 CRITICAL: Firestore rules broke portal + agent app — corrected rules issued

**What happened:**
The Step 3 Firestore rules published on 2026-08-09 set all `admin_*` collections
and the `schools` top-level document to `allow read, write: if authed()` — meaning
Firebase Auth session required. But the portal logs in with a **password check only**
(no Firebase Auth sign-in), and the agent app has **no Firebase Auth at all**.
Result: every portal write (deal approval, school creation, ledger entry) got
"Permission denied." Portal got stuck in a re-apply loop. Agent login also broke.

**Symptoms seen:**
- Portal: "APPROVAL FAILED — deal not updated. Permission denied."
- Re-Apply looped: generated orphan IDs BLOOM-SK5H8G and BLOOM-78QH8G for
  FUTURE PROMISE COMPREHENSIVE COLLEGE
- Multiple Wisdom Walks duplicates created from repeated agent submissions
  during agent-app permission error period
- Agent app: "Firebase permission error" on login

**Corrected rules issued 2026-08-10:**
All `admin_*` collections and `schools/{schoolId}` top-level set back to
`allow read, write: if true`. Strict auth rules kept ONLY on subcollections
(`staff_directory`, `students`, `private/fees`, `scores`) which are the ones
that actually contain sensitive student data.

**Bayo must:** paste the corrected rules in Firebase Console → Firestore → Rules
→ Publish. Portal SQ will auto-flush within seconds of publish.

**Cleanup still needed after rules publish:**
- Firestore → schools collection: delete whichever of BLOOM-SK5H8G / BLOOM-78QH8G
  did not fully create. BLOOM-78QH8G was the last re-apply attempt — verify it.
- admin_deals: reject duplicate Wisdom Walks entries (keep one per school).
- admin_approved_schools: remove any orphan approval records for the dead IDs.

### ✅ Agent app fix: corrected rules also fix agent login

The same corrected rules restore public read on `admin_agents`, `admin_deals`,
and `admin_ledger` — agent app login will work the moment rules are published.

---

## Previous Update — 2026-08-09

### Date display added to pending deals and approved schools
(Pending — was in progress when rules emergency interrupted. To be resumed.)

# bloom-portal (PRODUCTION — AariNAT Command Center)

Bayo's admin dashboard. Approves deals, manages agents, pays commission,
holds the Groq/HF/Gemini API keys the other two apps read at runtime.
**This is the live app, not a test sandbox.** Always verify on a real
device before considering a change done.

---

## 📜 Change History (newest first)

### 2026-08-03 — Two real fixes: missing Authorized Domain, and sw.js dropping CSS/JS on network hiccups

**Root cause of the login failures finally found — was never a network
problem, code bug, or API key issue.** Firebase Console → Authentication
→ Settings → Authorized domains was missing `portal.edubloom.com.ng` (and
`school.edubloom.com.ng`, `agent.edubloom.com.ng`). Only `kobomoba.github.io`,
`localhost`, and the two default Firebase domains were listed. Without the
actual custom domain authorized, `signInWithEmailAndPassword` calls fail —
and on the Firebase JS SDK, this specific misconfiguration surfaces as the
generic `auth/network-request-failed` rather than a clear "unauthorized
domain" error, which is why this took so long to pin down and why so many
network/code theories got chased first. **Bayo added the missing domains
himself in Firebase Console — no code change needed for this part.**

Lesson for next Claude: if `auth/network-request-failed` shows up on a
*custom domain* specifically (works or partially works on the default
`.firebaseapp.com`/`.web.app`/`.github.io` domains), check Authorized
Domains before anything else. It's a 30-second check that would have
saved a lot of back-and-forth.

**Second, unrelated bug found while chasing the above:** after several
rapid `sw.js` cache-bumps today (see 2026-08-02 entries), the page loaded
with zero CSS — raw unstyled HTML. Root cause: the old fetch handler's
error fallback only recovered the HTML *document* on a failed request
(`if (event.request.destination === 'document') return caches.match(...)`);
a dropped request for `style.css` or `portal_app.js` on Bayo's flaky
connection had no fallback at all and just silently failed, permanently
breaking the page until a lucky reload.

**Fix:** rewrote the fetch handler as network-first for *every* asset
(not just non-shell files), with a real cache fallback using
`{ignoreSearch: true}` so a cache-busted URL still matches whatever
version is cached, for any request type — not just documents. This also
fixes the earlier stale-cache class of bug more robustly: since it's
network-first now, a normal page load always gets the freshest deployed
code when online, and only falls back to cache when actually offline or
mid-connection-drop.

---

### 2026-08-02 (4) — Restored Firestore-password fallback (same pattern as the July 25 incident, this time intentional)

**Bayo:** "This kind of problem occurred at the early stage of the app
development" — correctly connecting today's lockout to the **July 25
unauthorized-lockout incident** (see that entry below): both times, login
depended entirely on one network path succeeding, with zero fallback if
it didn't.

**What was actually happening today:** `firebase.auth().
signInWithEmailAndPassword()` kept failing with `auth/network-request-failed`
— the request never reached Google's identitytoolkit servers at all, on a
connection that could otherwise browse fine. Firestore calls (agent app,
school app, other parts of this very portal) were unaffected — so
whatever the cause (carrier-level throttling of that specific Google API
domain, Brave Shields, or similar), it was selective to Firebase Auth's
network endpoint, not a general outage. Never fully root-caused because
it's not reproducible from this side — flagged as unresolved below.

**Fix:** the Firestore-password fallback that was removed on 2026-07-26
("now real Firebase Auth is confirmed working") has been restored,
**correctly this time** — as an actual fallback path inside `doLogin()`,
not a silent single point of failure:
1. Try `signInWithEmailAndPassword()` first, same as before.
2. **Any** failure (network or wrong password) falls through to comparing
   against `admin_settings/main.adminPassword` (default `aarinat2024` if
   never set) instead of failing outright.
3. Settings → "Backup Admin Password" field restored so Bayo can set/see
   (masked) this fallback from inside the app — no dependency on Claude
   or Firebase Console to manage it.

**This is not a repeat of the July 25 mistake.** That incident was an
*unauthorized* change that silently *removed* the working login path with
no way back in. This is the opposite: Bayo explicitly asked for this
fixed, it *adds* a path back in without removing the Firebase Auth one,
and both paths are visible/editable from inside the app itself.

**Not resolved — flag for next Claude:** *why* Firebase Auth's specific
network endpoint is unreachable on Bayo's connection while everything
else works. Worth checking, if it recurs: whether Brave Shields is
blocking `identitytoolkit.googleapis.com` for this site specifically, and
whether the Firebase project's Authorized Domains list
(Firebase Console → Authentication → Settings) includes
`portal.edubloom.com.ng` and the GitHub Pages default domain — an
unauthorized-domain condition can sometimes surface as a vague network
error rather than a clear "unauthorized domain" one on some SDK versions.

---

### 2026-08-02 (3) — doLogin() was hiding real errors behind "Incorrect password"

**Symptom:** Bayo tried the reset-link flow (see previous entry), got an
explicit `auth/network-request-failed` error from `sendPasswordResetEmail`,
then tried logging in directly with what should be the right password and
got "Incorrect password" — with no way to tell if the password was
actually wrong or if the *same* network flakiness was hitting the login
call too.

**Root cause:** `doLogin()`'s catch block hardcoded `errEl.textContent=
'Incorrect password.'` for every single Firebase Auth error, network
failures included. So a bad connection and a wrong password were
indistinguishable to the user — actively misleading when debugging.

**Fix:** catch block now branches on `authErr.code`:
- `auth/network-request-failed` → explicit "Network problem... NOT a
  wrong-password error" message, telling the person to check their
  connection.
- `auth/invalid-credential` / `wrong-password` / `user-not-found` /
  `invalid-login-credentials` → still says "Incorrect password." (the
  cases where that's actually true).
- anything else → shows the real Firebase error code + message instead of
  guessing.

**Lesson for next Claude:** don't collapse all auth errors into one
generic message — on a low-connectivity Nigerian mobile network, network
errors during login are common enough that hiding them behind "wrong
password" sends people down the wrong troubleshooting path every time.

---

### 2026-08-02 (2) — Fixed: sw.js was serving the pre-lockdown login screen

**Symptom:** Bayo tried to log in after the 25 July security lockdown
(legacy `admin_settings.adminPassword` removed) and still saw the *old*
login screen — "Enter admin password" / "aarinat2024" / "Update it in
⚙️ Settings" wording — with "Incorrect password."

**Root cause:** `sw.js`'s `CACHE_NAME` (`edubloom-portal-v1781679935`)
hadn't been bumped since before the lockdown. The service worker's
`fetch` handler is cache-first for the app shell (`index.html`,
`portal_app.js`, `style.css`), so his phone kept serving the cached
pre-lockdown files — the actual deployed code was already correct, it
just never reached his browser.

**Fix:** bumped `CACHE_NAME` to `edubloom-portal-v20260802-forcerefresh`.
On `activate`, the SW already deletes any cache whose name doesn't match
`CACHE_NAME` — so this alone forces every client to drop the stale shell
and re-fetch on next visit (SW already calls `skipWaiting()` +
`clients.claim()`, no other code changes needed).

**Lesson for next Claude:** `?v=N` on the `<script>` tag in `index.html`
(the existing cache-busting rule) does **not** help here — it only
busts the browser's *HTTP* cache. This app also has a service worker
with its own *separate* cache layer that ignores query strings entirely
(it caches by request URL as registered in `SHELL_ASSETS`, `'./index.html'`
etc., not by the querystring the browser actually requested). **Any push
that touches `index.html`, `portal_app.js`, or `style.css` should also
bump `CACHE_NAME` in `sw.js`** — otherwise the fix is live on GitHub/
GitHub Pages but invisible to anyone with the PWA already installed or
the site already visited. This applies to `bloom-agent` and
`School-Bloom` too if they carry a service worker — check before
assuming a push is "live" for the end user.

---

### 2026-08-02 — Reset Password tool for approved schools (Bayo-only)

**Requested by Bayo:** add "forgot password" everywhere a password is
required, and make it "retrievable." Since School-Bloom's staff passwords
are SHA-256 hashed (deliberately — Bayo confirmed this was to close
security loopholes), a hash can't be reversed back into the original
password. **Retrieval isn't possible by design; reset is the correct
secure equivalent**, so that's what was built.

**New: `resetPrincipalPassword(schoolId, schoolName, principalPhone)`** —
button on each Approved School card ("🔑 Reset Password"). Generates a
random 8-character password, then:
1. Reads `schools/{id}`, finds the staff entry with `role==='Principal'`,
   overwrites its `password` field with the new **plaintext** value.
   School-Bloom's `_verifyPassword()`/`_migratePasswordIfNeeded()` already
   handle a plaintext password transparently and auto-hash it on the
   Principal's next successful login — same path legacy passwords already
   use, so no hashing logic was duplicated here in the portal.
2. Syncs the same new password into `admin_approved_schools.password`
   (plaintext, used by the existing Resend/Copy buttons — was previously
   only ever set once at approval time and could go stale after any
   in-app password change; this keeps it current).
3. Logs the action, then offers to relay the new password to the
   Principal via WhatsApp.

**Explicitly Bayo-only, not agent-accessible.** Portal is already
password-gated to Bayo's own account, so this was safe by construction —
but the WhatsApp routing in School-Bloom's matching "forgot password"
links (see School-Bloom's README) was fixed in the same session to stop
directing locked-out Principals/staff to their **agent** (who has no way
to actually reset anything) and point them to AariNAT/Bayo directly
instead, since Bayo is the only person with this tool.

**Not done:** no equivalent per-staff-member reset tool in the portal —
that's handled inside School-Bloom itself now (Principal → Staff tab →
🔑 Reset, see that repo's README), since the Principal already has
legitimate reason to manage their own staff without going through Bayo
for every case.

---

### 2026-07-25 (3) — Security lockdown: legacy password removed, OCR keys split out of admin_settings

**Requested by Bayo:** "fix all" — after confirming his real Firebase Auth
account worked, close the remaining gaps from the two entries below.

**Removed the legacy Firestore-password login fallback entirely.**
`doLogin()` now only accepts real Firebase Auth
(`signInWithEmailAndPassword`) — no more back door via
`admin_settings.adminPassword`. The Admin Password field in Settings is
gone too, since it no longer did anything once the fallback was removed;
leaving it would have been actively misleading.

**Split OCR keys out of `admin_settings` into a new `public_ocr_keys/main`
document**, so the agent app can read `groqApiKey`/`hfApiKey`/
`ocrServiceUrl` directly — no external proxy, and without needing
`admin_settings` (which holds the admin password, WhatsApp template, etc.)
to stay world-readable. `syncOcrKeysToPublic()` mirrors just these three
fields whenever a key changes in Settings, or via the new "🔄 Sync OCR
Keys for Agent App" button. This is what let `bloom-agent`'s
`_fetchGroqKeyFromFirestore()` drop its Base44 proxy call entirely — see
that repo's README.

**Firestore rules — proposed, not yet published by Bayo as of this
commit** (he pastes these himself in Firebase Console, same as always,
so he sees the exact text for something this sensitive):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /admin_settings/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /public_ocr_keys/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_cac/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_activity/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_opportunities/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_ledger/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_agents/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_approved_schools/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_deals/{docId} {
      allow create: if true;
      allow read: if true;
      allow update, delete: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /admin_alerts/{docId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
    }
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Reads on `admin_agents`/`admin_deals`(create+read)/`admin_ledger`/
`admin_approved_schools`/`public_ocr_keys` stay open deliberately — the
agent and school apps have no real login of their own (agents look
themselves up by phone number, schools by School ID), so a hard auth
requirement there would break those apps outright. Closing that fully
means giving agents and schools real Firebase Auth identities, which is
a bigger redesign, not a rules tweak.

**Explicitly NOT done — `schools` collection stays on the open
catch-all.** This holds real schools' staff passwords in plaintext, live,
today. Locking it down properly needs schools to have real auth
identities rather than the current School-ID-lookup pattern, and the
current single flat document (config + staff + students + financials all
together, no field separation) doesn't cleanly support partial access
either. Doing this hastily risks a third lockout incident, this time
affecting real paying schools mid-day. Scope this as its own project with
a test school first, not a same-session addition.

**Commit:** `portal_app.js` (login + settings + sync function),
`index.html` (Settings UI + cache bump). **Verify:** log in normally,
confirm Settings still loads/saves, tap "Sync OCR Keys for Agent App"
once and confirm no error.

### 2026-07-25 (2) — Real Firebase Auth wired in properly (own project, no third party)

**Completes the fix from the entry below.** Sequence, so this never
repeats: got current Firestore rules from Bayo first (found `admin_settings`
already required `request.auth != null && request.auth.token.isAdmin ==
true` — left over from the Base44 change, and broken since nothing sets
that claim without a privileged Admin SDK call neither of us has easy
access to). Had Bayo create a real Firebase Auth account for himself
(`adebayoadesanya423@gmail.com`) via a standalone tool, confirmed the UID,
then updated the rule to check that specific UID instead of a claim:

```
match /admin_settings/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == 'HSpdm2NYK4hEGqBxyTPEi2wy39F2';
}
match /{document=**} {
  allow read, write: if true;
}
```
(Bayo pasted this into Firebase Console himself and published it — not
something pushed through code, since Firestore rules aren't deployable
from this environment and Bayo should see/approve the exact text for
something this sensitive anyway.)

**`doLogin()` now tries real Firebase Auth first** —
`signInWithEmailAndPassword(ADMIN_EMAIL, pwd)` — **and only falls back to
the legacy Firestore-password check if that fails.** Both paths still
work: type the new Firebase Auth password → real authenticated session,
`admin_settings` (API keys, WhatsApp template, admin password field) all
readable/writable again. Type the old Firestore password → still gets
into the dashboard (deals/agents/ledger, all on open rules), but
`admin_settings` reads/writes will fail until logged in with the real
account. **Bayo should use the new password going forward** — the old
one is a safety net during migration, not the long-term path.

**Not yet done, worth a second pass:** `admin_agents`/`admin_deals`/
`admin_ledger`/`admin_approved_schools` are all still `allow read, write:
if true` via the catch-all rule. They can't just be locked to
`request.auth != null` the way `admin_settings` was, because the agent
app and school app also read/write parts of them with no auth of their
own (see the access matrix below) — locking those down needs per-field
or per-operation rules (e.g. `allow create: if true; allow update,
delete: if request.auth != null` on `admin_deals`), not a blanket flip.
Flagging, not doing without Bayo scoping it first.

**Also noticed, not touched:** the live Firebase config
(`apiKey`/`appId`) in this file doesn't match the one used in
`bloom-agent`/`School-Bloom` — same project, different registered Web
App. Probably from the same unauthorized change. Harmless as-is (still
points at the same Firestore project), but worth knowing it's there.

**Access matrix, for reference on the next pass:**

| Collection | Read by | Write by | Lockable to admin-only? |
|---|---|---|---|
| `admin_settings` | portal only | portal only | ✅ done (this entry) |
| `admin_agents` | agent app (login) + portal | portal only | write only |
| `admin_deals` | agent app (own) + portal | agent app (create) + portal (update) | update/delete only |
| `admin_ledger` | agent app (own earnings) + portal | portal only | write only |
| `admin_approved_schools` | portal + school app (first login) | portal only | write only |
| `schools` | school app + portal | school app + portal | needs real per-school auth, bigger job |

**Commit:** `portal_app.js` (real auth + `ADMIN_EMAIL` constant) +
`index.html` (cache bumped to `?v=20260725-3`). Firestore rule published
directly by Bayo in Firebase Console.
**Verify:** log in with the new password, confirm Settings tab loads and
saves without errors — that's the real Firebase Auth path working.

### 2026-07-25 — URGENT: reverted unauthorized login change that locked Bayo out

**Reported by Bayo:** "Authorization is blocking my password" — couldn't
log into portal.edubloom.com.ng at all.

**What was found:** the login flow had been rewritten, without Bayo's
request, to:
- POST the entered password to an external Base44 cloud function
  (`https://superagent-626f0107.base44.app/functions/adminPortalLogin`)
  instead of checking it against Firestore `admin_settings/main.adminPassword`
- On success, sign in via `firebase.auth().signInWithCustomToken()` and
  gate the dashboard on an `isAdmin` custom claim minted by that same
  external function
- **Remove the Admin Password field from Settings entirely**, replacing
  it with "Login password is now managed securely server-side — ask
  your agent to rotate it if needed" — a dead end, since there was no
  "agent" left to ask and no rotation path in the app itself

Net effect: Bayo's real password stopped being checked at all, the
external function was either down, misconfigured, or expecting
different credentials Bayo never set, and there was **no self-service
way back in**. Full production lockout of the only person who runs this
company.

**This was very likely the same actor Bayo has repeatedly flagged for
making unrequested "improvements"** (referred to as "that base44 ai" /
Koda in other conversations). A real Firebase Auth + custom-claims setup
isn't a bad idea in principle, but shipping it as a silent one-way
migration with no fallback, no heads-up, and no way for the owner to
recover access is not acceptable on a production app — see standing
rule below.

**Fix — reverted to the last known-working, Bayo-controlled state:**
- `doLogin()` — back to comparing the entered password against
  `admin_settings/main.adminPassword` (default `aarinat2024` if unset),
  same as it's always worked
- Boot sequence — back to the local 8-hour session check
  (`localStorage.ad_auth` / `ad_auth_time`), not a live Firebase Auth
  session
- `logout()` — back to clearing local session state
- Settings — Admin Password field restored, `saveSettings()` writes it
  again. Bayo can see and change his own password from the app, no
  external dependency involved
- The `superagent-626f0107.base44.app` reference is now fully removed
  from this repo

**Not investigated / worth checking next:** whether Firestore security
rules were *also* tightened as part of this migration (e.g. requiring
`request.auth != null` more broadly). If dashboard data loads start
failing with permission errors even after a successful login, that's
the next thing to check — separate from this fix, and not something
that can be verified from a code review alone.

**Commit:** pushed to `portal_app.js` + `index.html`.
**Verify:** log in with your normal password at portal.edubloom.com.ng
and confirm you're in.

---

## ⚠️ Standing rule (added after this incident)

**No authentication, authorization, or access-control changes to any
EduBloom app without Bayo explicitly asking for them first**, regardless
of how well-intentioned. If a security gap is spotted (e.g. Firestore
rules not matching what `TECHNICAL_REFERENCE.md` documents), flag it in
this README and describe the tradeoffs — do not silently implement a
fix that could lock the owner out of his own production system.


---

## Changelog

### 2026-08-05 — Firebase API key consolidated

**Single Firebase web app registration across all apps**
- bloom-portal previously used a second Firebase web app registration (`appId: 0f9d338f`, `apiKey: AIzaSyDQ-Ss9...`)
- Reverted to the original single registration (`appId: 2b3da887`, `apiKey: AIzaSyCVEdunn3...`) shared with school-bloom, bloom-agent, and bloom-school-v2
- Both registrations point to the same `educationbloom-699ed` Firebase project (same Firestore, same Auth) — this is purely a cleanup for consistency
- The old registration (`0f9d338f`) is now orphaned and can be deleted from Firebase Console → Project Settings → Your Apps

**Rule established:** README.md must be updated after every completed task, in every repo that was touched.


---

## 📍 Current Position — 2026-08-07

### Status: Production — no pending changes

Portal is working correctly. All changes since last session:
- Firebase API key consolidated to single registration (`appId: 2b3da887`)
- `schools` collection alignment confirmed — portal writes to `schools`, school app now reads from `schools`

### Pending actions for Bayo
- **Publish Firestore security rules** — see `bloom-school-v2` README Step 3 section for the complete rules to paste into Firebase Console
- **Delete orphaned `v2_schools` collection** from Firestore Console (no app writes to it anymore)
- **Delete second Firebase web app registration** (`appId: 0f9d338f`) from Firebase Console → Project Settings → Your Apps


---

## 2026-08-10 — Session: Approval Bug Fix + Term Calendar + Emergency Password Removal

### Changes pushed this session (2 files: `portal_app.js`, `index.html`)

---

### 🔴 BUG FIX — FUTURE PROMISE COMPREHENSIVE COLLEGE stuck in pending

**Root cause identified:**
`confirmApproval()` was routing the critical `status:'approved'` Firestore write through the
**SQ (Sync Queue)** instead of writing directly. The SQ silently retries failed writes up to
3 times then **drops them with no notification**. When the portal was in a "Syncing" state
(visible in screenshot at 11:53 PM), the SQ was backed up. The write got dropped, the deal
stayed permanently "pending" even though school ID `BLOOM-CE4QTD` had already been generated.

**Fix applied:**
- `confirmApproval()` now writes `status:'approved'` directly to Firestore (not via SQ) as
  the very first action. If the write fails, an alert shows immediately with:
  - The exact error (e.g. permission denied, network error)
  - The school ID and password so they can be written down
  - The deal is flagged so the Re-Apply button appears
- `admin_approved_schools` record is also written directly (not via SQ) with fallback to SQ
  only if the direct write fails
- SQ still used for non-critical operations (ledger, CAC, activity log)

**Stuck-deal detection (new):**
Any pending deal that already has a `schoolId` assigned (codes were generated but the Firestore
write failed) now shows:
- Yellow `⚠️ CODES ISSUED — STUCK` badge with the assigned ID shown
- **🔄 Re-Apply Approval** button instead of the regular Approve button
- Clicking it re-runs the full `confirmApproval()` flow including WhatsApp credentials send

**Immediate action for FUTURE PROMISE:** Reload portal → Pending tab → tap
**🔄 Re-Apply Approval** on the Future Promise card.

---

### 🗑️ Emergency password removed

The `AariNAT-Emergency-2026!` client-side bypass block (added 2026-08-03 after repeated
Firebase Auth lockouts) has been **permanently deleted** from `portal_app.js`.

**Bayo's explicit instruction:** "Delete the emergency password. I will continue to use aarinat2024."

**Login flow now (two paths only):**
1. `signInWithEmailAndPassword()` via Firebase Auth — tried first, every time
2. If Firebase Auth fails (network unreachable), falls back to Firestore backup password
   — defaults to `aarinat2024`, changeable in Settings → Admin Password

No third path exists. There is no client-side bypass.

The one reference to "Emergency Access" in the approval error message was also updated to:
*"your login session may have expired. Logout and log back in with aarinat2024."*

---

### 📅 Nigeria Term Calendar (new feature)

**New `📅 Calendar` tab** added to the portal navigation (in `index.html` + `portal_app.js`).

**What it does:**
- Shows all 6 term blocks (2025/26 Term 1–3, 2026/27 Term 1–3) with resumption and vacation dates
- Currently active term is highlighted in green with `● ACTIVE` label
- State-specific calendars for: Lagos, Ogun, Oyo, Osun, Ondo, Ekiti, FCT, Rivers, Kano, Kaduna
- A national `_default` calendar for all other states
- **Edit button**: select any state → change resumption/vacation dates → tap **💾 Save Dates**
  → persists to Firestore `admin_settings/main.termCalendar` immediately
- **➕ Add State** button to add any of the other 26 states

**Integration with approvals:**
`calcTermExpiry()` now uses the calendar to set the subscription expiry date to the actual
end-of-term vacation date for the school's state, instead of a flat 3-months-per-term estimate.
Calendar cache is pre-warmed at login so the first approval calculates correctly.

**Firestore storage:** `admin_settings/main.termCalendar` — merged field, non-destructive.

---

### ⏰ Activation timestamps added to approved school cards

Approved school cards now display:
```
🕐 Activated: 10 Aug 2026, 04:46 AM · 📍 Ogun
```
Both `activatedAt` (set to Firestore server timestamp on approval) and `state` are stored
in `admin_approved_schools/{schoolId}` for new approvals going forward.

---

### Commits this session
- `ff107c6` — portal_app.js: direct write + stuck-deal re-apply + term calendar + timestamps
- `f26b745` — index.html: Calendar tab + calendar section HTML
- `32793d9` — portal_app.js: remove emergency password, update error message

### Standing rules (unchanged)
- **Update README after every action, same session, no exceptions**
- No auth/access-control changes without Bayo explicitly requesting them
- aarinat2024 is the one and only portal password. No hardcoded bypasses.


---

## 2026-08-10 — Strategic Decision: Basic Tier Eliminated

**Bayo's decision:** Basic tier completely eliminated. All schools are now Premium.
New slogan: **GIVE YOUR SCHOOL THE PREMIUM EXPERIENCE**

No portal-side code changes required for this decision — the portal's tier structure
(Starter 1–50, Small 51–100, Medium 101–200, Large 201–350, Enterprise 351+) represents
pricing bands for the single Premium product, not a Basic vs Premium split.
These pricing tiers remain unchanged.


---

## 2026-08-12 — Premium Prices Applied to Portal

### Files changed
- **`portal_app.js`** — `TIERS` array in `renderApprovedList()` updated to Premium prices
  (used for over-tier detection, renewal calculation, and commission display)
- **Demo deal seed** — updated from `Small (51–100) ₦20,000` to `Premium · 51–100 ₦30,000`

| Tier | Basic (old) | Premium (new) |
|---|---|---|
| 1–50 | ₦10,000 | ₦15,000 |
| 51–100 | ₦20,000 | ₦30,000 |
| 101–200 | ₦35,000 | ₦52,500 |
| 201–350 | ₦55,000 | ₦82,500 |
| 351+ | ₦75,000 | ₦112,500 |

### Commit
- `e5d1e7b` — portal_app.js: TIERS + demo deal to Premium pricing


---

## 2026-08-12 — Portal: Agent Requests Real-Time System

### What was built

**`portal_app.js` (`54e88d0`):**

`startAgentRequestsListener()`:
- Called on `initAdmin()` — starts immediately at login
- `onSnapshot` listener on `admin_agent_requests` where `status == 'pending'` ordered by `submittedAt` desc
- Fires `renderAgentRequests(requests)` on every change

`renderAgentRequests(requests)`:
- If 0 requests: hides card, hides nav badge
- If 1+ requests: shows card, updates nav badge (amber, shows count), renders each request card

Each request card shows:
- Name, phone, state, source, submission timestamp
- ✅ Approve | ❌ Reject | 💬 WhatsApp buttons

`approveAgentRequest(reqId, name, phone, state)`:
1. Confirms with Bayo (dialog)
2. Creates agent in `admin_agents`: `{name, phone, state, commission:20, joinedAt, approvedFrom:'agent_request', requestId, active:true}`
3. Marks request `status:'approved'` in `admin_agent_requests`
4. Calls `renderAgents()` to refresh the active agents list
5. Opens WhatsApp to new agent with welcome message including login URL and their phone number

`rejectAgentRequest(reqId, name, phone)`:
1. Prompts Bayo for optional rejection reason
2. Marks request `status:'rejected'` in `admin_agent_requests`
3. If reason provided: opens WhatsApp to applicant with polite rejection + reason

**`index.html` (`4b3f7d1`):**
- `👥 Agents` nav button now has amber badge (`agent-req-badge`) showing pending count
- `sec-agents` section now has "📬 Pending Agent Requests" card at the top
  (hidden when no requests, shown automatically when requests arrive via listener)
- Existing agent management (Add/Edit/Delete) unchanged — relabelled "Active Agents"

### Firestore collections used
- `admin_agent_requests` — pending/approved/rejected agent applications
- `admin_agents` — existing collection, now also written to by approval flow


---

## 2026-08-12 — Portal: Agent Request Cards Show Photo + Bank Details

**`portal_app.js` (`9ec0faf`):**

`renderAgentRequests()` — each card now shows:
- Agent's face photo (52px circle) if submitted; 👤 placeholder if not
- Name, phone, state as before
- Green "💳 Commission Account" block: bank name · account number + bold account name
- Yellow "⚠️ No bank details provided" warning if bank fields missing

`approveAgentRequest()` — now:
1. Fetches full request doc from Firestore (to get photo + bank details, which weren't in the onclick params)
2. Saves to `admin_agents`: `{name, phone, state, commission:20, active:true, photo, bankName, acctNum, acctName, approvedFrom:'agent_request', requestId}`
3. WhatsApp welcome message to new agent now includes their registered bank details as confirmation


---

## 2026-08-12 — Agent ID Card Auto-Generated on Approval

### What was built (`portal_app.js` — commit `684f1eb`)

**`generateAgentIDCard(agent, docId)`** — Canvas-based ID card (856×540px, ~credit card ratio):

Design:
- Deep purple gradient background (#0f0a2e → #1e1254 → #0a0621)
- Gold stripe top and bottom (linear gradient b8860b → ffd700 → f59e0b)
- Subtle grid overlay
- Left purple accent bar
- **"EduBloom"** logo in white + gold (top left)
- **"🌸 BLOOM AGENT"** badge with gold border (top right)
- Agent ID chip: `AGENT-XXXXXX` (first 6 chars of Firestore doc ID)
- **Agent photo** in a 100px circle with gold ring + purple glow shadow
  - If no photo: grey placeholder with 👤 icon
  - Photo drawn asynchronously, card completes via `finishCard()` callback
- Agent **name in caps** (font scales down if name is too long)
- Gold underline separator below name
- Four detail rows: 🪪 Agent ID · 📱 WhatsApp · 📍 Territory · 💰 Commission (20%)
- Commission account box (purple tint): Bank · Account Number · Account Name
- Gold italic slogan: *GIVE YOUR SCHOOL THE PREMIUM EXPERIENCE*
- Footer: AariNAT Company Limited · agent.edubloom.com.ng · +234 814 507 3941

**`showAgentIDCard(agent, docId)`** — shows card in a modal:
- Full-width card image preview
- ⬇️ Download PNG (filename: `EduBloom_Agent_David_Adeyemi.png`)
- 🖨️ Print (opens new window, prints, closes)
- ✕ Close
- Tip: "Right-click → Save Image As. Forward via WhatsApp."

**`printAgentIDCard(dataUrl)`** — opens print-optimised page

**`viewAgentIDCard(agentId)`** — fetches agent from Firestore and shows card; available on every agent row in the active agents list via 🪪 ID Card button

**Auto-triggered:** `approveAgentRequest()` now calls `showAgentIDCard()` 600ms after approval so Bayo sees the card immediately and can download/print/forward it to the new agent right away.

**Agent list cards** now show:
- 40px photo avatar (or 👤 placeholder)
- State and bank details
- 🪪 ID Card button (first button in the action row)


---

## 2026-08-15 — Branding Correction: Edu-BLOOM (not EduBloom / Educational Bloom)

**Issue identified:** The real logo uses "Edu-" in purple and "BLOOM" in orange. The codebase
had been using "EduBloom" (no hyphen, wrong caps) and "Educational Bloom" (wrong expansion
entirely) across all three apps and all WhatsApp message templates.

**Total replacements across all 6 files: 52**

| Wrong | Correct | Count |
|---|---|---|
| `Educational Bloom` | `Edu-BLOOM` | 17 |
| `EduBloom` | `Edu-BLOOM` | 35 |

**ID card canvas logo (portal_app.js):**
- Before: `ctx.fillStyle = '#ffffff'` → `fillText('Edu', ...)` + `ctx.fillStyle = '#f59e0b'` → `fillText('BLOOM', ...)`
- After: `ctx.fillStyle = '#7c3aed'` (purple) → `fillText('Edu-', ...)` + `ctx.fillStyle = '#f97316'` (orange) → `fillText('BLOOM', ...)`

The hyphen is now included. Logo baseline raised from y=55 to y=57 to accommodate 30px font (was 28px).



---

## 2026-08-16 — Edu-BLOOM User Manual Released

A 32-page user manual for the Edu-BLOOM school app has been written and committed to
the School-Bloom repo as `EduBLOOM_School_App_Manual.docx`. Written in plain English
with zero technical jargon. All 23 feature areas covered with step-by-step instructions.

An in-app help system (18 searchable accordion topics) was also added to the school app
under ❓ Support in the menu.

No changes to bloom-portal in this session.
