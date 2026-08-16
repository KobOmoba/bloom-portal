# Security Review Questionnaire — Educational Bloom
## Questions a security review team will ask + EduBloom answers

---

## 1. Identity & Access Management

**Q: How do users authenticate?**  
A: Three separate auth flows. Schools: School ID + staff email + SHA-256-hashed password (step-2 staff login). 
Agents: phone number lookup in admin_agents (no password — first-factor only). 
Admin portal: Firebase Auth (signInWithEmailAndPassword) with Firestore password fallback.

**Q: Are passwords hashed? Which algorithm?**  
A: SHA-256 via the Web Crypto API. No third-party library. Passwords are hashed client-side before 
being written to Firestore. Legacy plaintext passwords are migrated on first login via `_migratePasswordIfNeeded()`.

**Q: Is there multi-factor authentication?**  
A: Not currently. Compensating control: school data is accessible only by knowing a School ID (BLOOM-XXXXXX format) 
AND the correct staff password. Agent access requires a phone number registered by AariNAT admin — self-registration 
is disabled. MFA is on the roadmap.

**Q: What is session timeout?**  
A: Admin portal: 8-hour hard expiry (localStorage `ad_auth_time`). School portal: persists until logout 
(Remember Me toggle). Agent app: persists until logout, refreshes profile from Firestore in background.

**Q: How do you revoke access for a compromised account?**  
A: Admin deletes the agent from admin_agents (portal). For schools, admin can delete the school 
document from Firestore Console or via the portal repair/delete flow. Per-school Firebase Auth 
revocation is planned as part of the full RBAC hardening.

**Q: What happens when a staff member leaves a school?**  
A: Principal deletes the staff record from the school's staff array. 
In the V2 model, this also removes their `staff_directory/{uid}` entry, revoking Firestore access.

---

## 2. Authorization & Access Control

**Q: How is RBAC enforced — client-side or server-side?**  
A: Both. JavaScript gates in the app prevent navigation and hide UI. Firestore security rules enforce 
the same roles server-side on all reads and writes. A student opening DevTools and typing 
`userRole = 'Principal'` would bypass the UI gate but NOT the Firestore rule 
(subcollection reads/writes require `isStaffOf()` via Firebase Auth).

**Q: Can a Class Teacher see another class's students?**  
A: No. Client-side: `getAssignedClass()` filters the student list. Server-side: the `students/{id}` 
subcollection rule checks `myClass(schoolId) == resource.data.class`.

**Q: Can a Bursar access academic scores?**  
A: No. Firestore rule for `scores/{id}` subcollection only allows 
`isPrincipal()`, `isClassTeacher()` (own class), or `isSubjectTeacher()` (own subjects).

**Q: What prevents School A from reading School B's data?**  
A: Each school's data is stored under `schools/{schoolId}/...`. Firestore rules use 
`isStaffOf(schoolId)` which checks for the requesting user's Firebase Auth UID in 
`schools/{schoolId}/staff_directory`. A user not in that specific school's staff_directory 
cannot access its subcollections.

**Q: Can a student manipulate their own scores?**  
A: Scores in V2 subcollections: No. `scores/{id}` requires `isStaffOf()` — students have no 
Firebase Auth account in `staff_directory`, so all writes are blocked. Flat parent document 
scores: previously possible via `silentPull()` injection — fixed 2026-08-15 (silentPull 
now ignores sensitive keys from the flat doc).

---

## 3. Data Protection & Privacy

**Q: What personal data do you collect?**  
A: Student: name, phone number, class, academic scores, attendance, fee payment history, 
optional health/medical notes. Staff: name, email, hashed password, role. 
Parent: phone number (via student record). Agent: name, phone number.

**Q: Where is data stored?**  
A: Google Firebase Firestore (multi-region). AariNAT is working with Google's Data Processing 
Agreement. Physical data residency region: configurable — currently default Firebase region.

**Q: Is data encrypted in transit?**  
A: Yes. All apps are served over HTTPS (GitHub Pages enforces TLS). Firebase SDK uses TLS for 
all Firestore communication.

**Q: Is data encrypted at rest?**  
A: Yes. Firebase Firestore encrypts all data at rest using AES-256 by default 
(Google-managed encryption keys).

**Q: Who at AariNAT has access to raw Firestore data?**  
A: Only the Firebase Admin account (adebayoadesanya423@gmail.com). Firebase Console access 
is protected by Google Account 2FA.

**Q: How long is data retained after a school cancels?**  
A: 24 months after subscription end. Schools may request earlier deletion by contacting AariNAT.

**Q: Can schools export their own data?**  
A: Not yet via self-service. AariNAT can produce a JSON export on request. 
Self-service data export is planned.

---

## 4. NDPA 2023 Compliance

**Q: Is AariNAT registered with NDPC as a Data Controller?**  
A: Registration required before scaling past Stage 2 (50+ schools). Currently at Stage 1.

**Q: Is there a Privacy Notice for schools and parents?**  
A: Yes. Legal pages deployed at edubloom.com.ng: Privacy Policy (NDPA 2023), 
Terms of Use, Data & Compliance policy, IP/Copyright policy.

**Q: What is the lawful basis for processing student data?**  
A: Contract (school subscription agreement) + Legitimate Interest (providing the service schools pay for). 
Schools act as data controllers for their students; AariNAT is a data processor.

**Q: How do you handle a Data Subject Access Request (DSAR)?**  
A: Via email to aarinat.company.limited@gmail.com. Response within 30 days per NDPA requirements. 
Data export produced from Firestore for the specific school.

**Q: What is your breach notification process?**  
A: NDPC notification within 72 hours of discovery. Affected schools notified within 24 hours via 
WhatsApp and email. Bayo (RC-1732521) is personally responsible as Data Controller.

**Q: Is a Data Protection Impact Assessment (DPIA) done?**  
A: Not yet formally. Recommended before onboarding more than 10 schools.

---

## 5. Application Security

**Q: Are you protected against XSS (Cross-Site Scripting)?**  
A: Yes. All user-generated content is output-encoded via `esc()` which uses DOM `textContent` 
assignment then reads `innerHTML` — this encodes `<>&"`. Apostrophe encoding (`&#39;`) 
was added 2026-08-14 after a pentest finding.

**Q: Are you protected against CSRF?**  
A: Not explicitly. Firebase SDK uses Firebase Auth tokens for authenticated operations, 
which provides implicit CSRF protection for auth-gated operations. 
Public-write operations (agent deal submission) don't require auth tokens.

**Q: How are API keys (Groq, HuggingFace, Firebase) protected?**  
A: Firebase API key is intentionally public (Firebase design) — access is governed by Firestore rules, 
not the key. Groq and HuggingFace keys are stored in Firestore `admin_settings` (Bayo-UID-only) 
and `public_ocr_keys` (public read, Bayo-UID write). OCR keys are intentionally public-readable 
because the school portal must access them without requiring school-level Firebase Auth.

**Q: Is there rate limiting on OCR endpoints?**  
A: Groq free tier has built-in rate limits. No additional rate limiting at the app level.

**Q: How do you validate OCR output before writing to the database?**  
A: `looksLikeValidName()` filters OCR output — rejects strings with digits, special chars, 
UI keywords, consonant clusters, and strings without proper nouns. Score values are capped 
at max CA/exam values at display time. Future improvement: server-side score validation.

---

## 6. Infrastructure

**Q: Where is the application hosted?**  
A: GitHub Pages (Fastly CDN). Free tier — no SLA. Uptime historically >99.9% for GitHub Pages.

**Q: How are DNS records secured?**  
A: .com.ng domains registered via a Nigerian registrar. Manual renewal — auto-renewal 
recommended. DNSSEC status depends on registrar configuration.

**Q: What is the disaster recovery plan?**  
A: All source code is on GitHub (redundant). Firebase Firestore has automatic daily backups 
(Google-managed). Point-in-time recovery: not configured (requires Firebase Blaze plan feature). 
Manual backup via portal's "Export All" JSON download.

---

## 7. Third-Party Risk

**Q: What happens if GitHub Pages goes down?**  
A: App is unavailable. Offline mode (PWA + localStorage) allows schools to continue recording 
data locally. Data syncs back to Firestore when connectivity returns.

**Q: Does Groq/HuggingFace process Nigerian students' data?**  
A: When OCR score sheet feature is used, photos of paper registers (containing student names) 
are sent to Groq (primary) or HuggingFace (fallback). This is disclosed in the privacy policy. 
Schools using this feature should inform parents.

**Q: Are there DPAs with third-party processors?**  
A: Google Firebase: Google's standard DPA applies. Groq/HuggingFace: Currently under review. 
This is a gap to address before NDPC registration.

---

## 8. Incident Response

**Q: Who leads incident response?**  
A: Bayo Adesanya, Founder, AariNAT Company Limited. 
Contact: +234 814 507 3941 / aarinat.company.limited@gmail.com.

**Q: How quickly can a compromised school account be locked?**  
A: Within minutes — Bayo can delete the `schools/{schoolId}` document from Firebase Console 
or change the password via portal. Firebase Auth account revocation also available via Console.

**Q: Is there an audit log?**  
A: Yes. All portal admin actions are logged to the `admin_activity` Firestore collection 
(Bayo-UID-only access). Timestamp, action description, and context are recorded.

**Q: How do you handle a rogue agent submitting fake deals?**  
A: Portal shows all pending deals with agent identity. Bayo reviews and rejects manually. 
Fake deals can be identified by phone number cross-referencing and school verification. 
Rogue agents can be deleted from `admin_agents` immediately.

---

## 9. Open Items (to address before NDPC registration)

| Item | Priority | Status |
|------|----------|--------|
| Full per-school Firebase Auth (lock schools/{id} parent writes) | HIGH | 🔜 Next session |
| DPAs with Groq and HuggingFace | HIGH | ⏳ Pending |
| Formal DPIA | MEDIUM | ⏳ Pending |
| NDPC registration | MEDIUM | Stage 2 milestone |
| Self-service data export for schools | MEDIUM | Planned |
| Multi-factor authentication for admin portal | MEDIUM | Planned |
| Auto-renewal for .com.ng domains | LOW | ⏳ Pending |
| Point-in-time Firestore backup (Blaze plan) | LOW | Planned |

---
*Prepared by: Claude (Anthropic) for AariNAT Company Limited · 2026-08-15*  
*Review cycle: Update after every pentest session*
