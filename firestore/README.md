# EduBloom Firestore rules

`live-2026-10-31.rules` is a copy of what was live on 31 Oct 2026.
`firestore.rules` is the **proposed** rule set (live rules + fixes) for the live Firebase project
(`educationbloom-699ed`). It is tested here against Google's local Firestore emulator,
so **no live data is touched**.

`rules.test.mjs` signs in as a stranger, school A, school B, a look-alike email, an
agent and the admin, and checks each can open only what it should (14 checks).

- Runs automatically on GitHub (Actions → "Firestore rules tests") whenever these files change.
- Publishing the rules to the live project is done by Bayo in the Firebase Console
  (Firestore → Rules → paste → Publish). Claude never publishes rules.

Run the checks against the old live copy with `RULES=live-2026-10-31.rules npm test` (17 of 22 fail).
