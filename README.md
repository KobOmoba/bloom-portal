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
