# bloom-portal (PRODUCTION — AariNAT Command Center)

Bayo's admin dashboard. Approves deals, manages agents, pays commission,
holds the Groq/HF/Gemini API keys the other two apps read at runtime.
**This is the live app, not a test sandbox.** Always verify on a real
device before considering a change done.

---

## 📜 Change History (newest first)

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
