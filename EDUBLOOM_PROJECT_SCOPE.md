# EduBloom — Project Scope Document
**AariNAT Company Limited | RC-1732521**
**Document version:** 1.0 | **Date:** 2026-08-20
**Prepared by:** Bayo Adesanya, Founder & CEO

---

## 1. Project Summary

EduBloom is a three-application school management SaaS suite built for Nigerian private
schools. It is delivered as a set of Progressive Web Apps (PWAs) hosted on GitHub Pages
and backed by Google Firebase Firestore. The product is sold via field agents who earn
commission on each school subscription.

---

## 2. In Scope

The following and only the following deliverables are included in the current build.

### 2.1 bloom-agent (agent.edubloom.com.ng)
- Phone-number login (no Firebase Auth — Firestore lookup)
- Offline-first deal submission with auto-sync queue
- Tier selector with auto-commission calculator
- Student register counter (CSV, text, and photo OCR via Groq/HuggingFace)
- Deal history view with approval status
- Agent earnings and commission display
- Deep-link support for admin-initiated agent activation
- WhatsApp onboarding message to approved schools

### 2.2 bloom-portal (portal.edubloom.com.ng)
- Firebase Auth login with 8-hour session timeout
- Real-time pending deal listener with approve / reject
- School ID generation (BLOOM-XXXXXX format)
- WhatsApp credential delivery on school approval
- Agent management — add, edit, delete, activate
- Commission ledger — new (20%) and renewal (10%) entries, mark-paid
- CAC Reactivation Fund tracker (target ₦250,000)
- Opportunities board — grants, scholarships, fellowships for schools
- Activity log
- Admin settings — password, default school password, WhatsApp template
- Approved schools list with tier status, tier-exceeded alerts, plan upgrade
- Production reset (wipe test data before go-live)
- Full data export (JSON backup)

### 2.3 School-Bloom (school.edubloom.com.ng)
- School ID + staff email/password login (custom RBAC — no Firebase Auth per school)
- Four staff roles: Principal, Bursar, Class Teacher, Subject Teacher
- Offline-first with silent Firestore sync
- Student management — add, import (CSV/text/photo), edit, delete
- Bulk payment matching from bank statement CSV
- Fee collection — record payments, payment history, edit/delete payment entries
- WhatsApp fee reminders (individual and bulk)
- Attendance — mark present/absent/late, 14-day history, correct past entries
- Morning absence alert (Safety F1)
- Scores — per-term CA and exam entry, grade calculation, class average
- Bulk score entry grid (tab/enter navigation)
- Broadsheet / scorecard with class rankings and subject champions
- Report card generation (individual + all-class batch print)
- End-of-term wizard
- Cumulative report across three terms
- Affective domain and psychomotor skills rating
- Expenses — log, edit, delete, category totals
- Finance tab — summary view
- Staff management — add, edit, delete, role assignment with class/subject assignment
- Sports, Arts, Music tabs — basic logging
- Alumni tracking with donation logging
- Health records — AES-256-GCM encrypted, Principal-only, audit-logged (sandbox 2026-08-20)
- Communications log
- Social pages links
- Opportunities display (fed from portal)
- Support tab — agent contact, WhatsApp escalation
- Settings — school name, term, fee amount, subjects, WhatsApp, plan, days opened
- Demo mode (no login required, pre-loaded sample data)
- BloomCollect payment link (Premium plan, Firebase Functions — not yet deployed)

### 2.4 Shared Infrastructure
- Single Firebase project (educationbloom-699ed)
- Firestore rules: Bayo-only admin collections, public-read agent/deal collections, open school documents
- GitHub Pages CI/CD via KobOmoba account
- Service worker offline caching with versioned CACHE_NAME
- OCR pipeline: Groq Vision primary → HuggingFace fallback → OCR.space last resort
- OCR keys synced from portal to `public_ocr_keys/main`
- Sandbox repos for all three apps (bloom-agent-v2, bloom-portal-v2, school-bloom-v2)
- Sandbox-first development workflow

---

## 3. Out of Scope

The following are explicitly excluded from the current engagement.
Any request touching these areas triggers a Change Order (see Section 4).

### 3.1 Payment Processing
- BloomCollect Kora webhook — Cloud Functions written but not deployed. Live payment collection, webhook verification, automated receipt generation, and refund handling are **not in scope**.
- Any other payment gateway integration (Paystack, Flutterwave, Interswitch, Remita)
- Bank transfer reconciliation against school accounts
- Direct debit or standing order setup
- Parent payment portal with card-on-file
- Installment payment scheduling and automated reminders
- Receipt printing in any format other than WhatsApp text

### 3.2 Native Mobile Applications
- iOS application (App Store)
- Android application (Google Play Store)
- React Native, Flutter, or any other cross-platform native build
- Push notifications (native device push — PWA web push only is in scope if requested as change order)
- Biometric authentication (fingerprint, face ID) on device

### 3.3 Messaging and Communication Automation
- WhatsApp Business API automated messaging (all current WhatsApp is manual wa.me link)
- Bulk SMS via any gateway (Africa's Talking, Termii, Twilio, etc.)
- Email delivery (no SMTP, no SendGrid, no Mailchimp integration)
- In-app chat between teachers and parents
- In-app chat between school and agent
- Automated morning absence SMS to parents
- Automated fee reminder campaigns
- Push notification campaigns

### 3.4 Parent and Student Portals
- Parent login or parent-facing app of any kind
- Parent fee payment self-service
- Parent attendance notification feed
- Parent-teacher messaging portal
- Student self-service portal (homework submission, result checking, timetable view)
- Student CBT (computer-based testing) portal
- Homework assignment and submission tracking

### 3.5 Learning Management System (LMS)
- Course content creation or delivery
- Video lesson upload or streaming
- Assignment creation, distribution, and grading workflow
- Digital library or e-book repository
- Academic calendar management beyond current term/session field
- Curriculum planning or scheme of work builder
- Lesson note repository and approval workflow
- Online examination engine

### 3.6 Human Resources and Payroll
- Staff payroll calculation and disbursement
- Salary slip generation
- Leave management (annual leave, sick leave, maternity)
- Pension and tax deduction computation (PAYE, NHF, NSITF)
- Staff appraisal and performance management
- Job posting and applicant tracking
- Staff contract generation
- HR compliance reporting

### 3.7 Finance and Accounting
- Double-entry bookkeeping
- Chart of accounts
- QuickBooks, Sage, or any accounting software integration
- VAT computation and FIRS filing
- Budget planning and variance analysis
- Bank statement import and reconciliation (beyond the bulk-payment CSV already in scope)
- Petty cash management
- Purchase order and vendor management
- Fixed asset register and depreciation

### 3.8 Infrastructure and Administration
- Transportation and school bus tracking
- Canteen, cafeteria, or tuck shop management
- Library management system (book catalogue, borrowing, returns)
- Hostel and dormitory management
- Inventory and asset management
- Timetable scheduling engine (automated conflict resolution)
- Classroom and resource booking
- Lost-and-found management
- Visitor management and gate log

### 3.9 Government and Regulatory Reporting
- EMIS (Education Management Information System) data submission
- Ministry of Education compliance reports
- National Population Commission school census reports
- WAEC / NECO / JAMB / BECE result submission or tracking
- State education board inspection readiness reports
- School accreditation documentation system

### 3.10 Multi-Tenant and Enterprise Features
- Multi-school chain management (one login to manage many schools)
- Franchise or group school dashboard
- White-label rebranding per school (custom logo, domain, colour scheme)
- School-to-school data benchmarking
- District or LGA-level reporting aggregation
- API access for schools to integrate EduBloom with their own systems
- Webhooks for external system integration

### 3.11 Hardware Integration
- Biometric attendance (fingerprint machines, facial recognition cameras)
- RFID student ID card scanning
- CCTV camera feed or recording integration
- Intercom or PA system control
- Computer lab management software
- Smart board integration

### 3.12 Third-Party App Integrations (unless Change Ordered)
- Google Workspace or Microsoft 365 integration
- Zoom or Google Meet scheduling inside the app
- Moodle or any open-source LMS bridge
- Accounting software (QuickBooks, Sage, Wave)
- CRM integration (HubSpot, Salesforce)
- Document signing (DocuSign, Adobe Sign)

### 3.13 Artificial Intelligence Features
- AI-generated lesson plans or teaching resources
- AI essay grading or plagiarism detection
- Predictive analytics for student performance
- Chatbot for parent queries
- AI-generated personalised student feedback narratives
- Behaviour prediction or early-warning systems

### 3.14 Data Migration
- Migration of historical student records from any existing system (paper or digital)
- Import of historical fee records, attendance, or scores from previous terms
- Bulk migration from any third-party school management platform
- Data cleaning or normalisation of externally sourced datasets

### 3.15 Security Features Not Yet Built
- Per-school Firebase Auth (each school staff logs into Firebase — deferred, own project)
- Two-factor authentication (2FA) for portal login
- Penetration testing by external security firm
- SOC 2 certification
- ISO 27001 audit
- Automated NDPC breach notification workflow

### 3.16 Other Products in the AariNAT Portfolio
- PharmGo Rx (separate WhatsApp-native pharmacy platform)
- TECI / NECH (telecom-energy convergence framework)
- HECI, ACCI, PLCI, PLCI frameworks
- Any KingBayo content or empire-related repositories
- Telegram bot or any non-EduBloom automation

---

## 4. Change Order Process

### 4.1 What Triggers a Change Order

A Change Order is required whenever a request:
- Adds a feature, screen, integration, or workflow not listed in Section 2
- Modifies a delivered and accepted feature beyond a bug fix
- Moves an item from Section 3 (Out of Scope) into the build
- Requires a new third-party account, API key, or paid service
- Changes an accepted data model in a way that requires migration of existing data

Bug fixes to delivered features do **not** trigger a Change Order.
Security patches to delivered features do **not** trigger a Change Order.
README and documentation updates do **not** trigger a Change Order.

### 4.2 Change Order Process Steps

**Step 1 — Written Request**
The requesting party submits the change in writing via WhatsApp to +234 814 507 3941
or email to aarinat.company.limited@gmail.com. The request must include:
- What is being requested (feature description)
- Why it is needed (business reason)
- When it is needed (proposed timeline)

**Step 2 — Scoping and Quote (within 48 hours)**
AariNAT reviews the request, assesses effort, and returns a written quote containing:
- Confirmation that the request is understood
- Estimated delivery timeline
- Price (see Section 4.3)
- Any dependencies or assumptions

**Step 3 — Written Approval**
The requesting party approves the quote in writing (WhatsApp or email).
Work does not begin until written approval is received and deposit is paid.

**Step 4 — Implementation**
Standard sandbox-first development process applies.
All change orders follow the same quality gate: build in sandbox → present for review → port to production on approval.

**Step 5 — Acceptance Testing**
The change order is complete when it passes the Acceptance Criteria defined in Section 5
and any additional criteria specified in the Change Order quote.

### 4.3 Change Order Pricing

| Size | Definition | Price |
|------|-----------|-------|
| Minor | Single UI change, single field, copy edit, minor logic tweak — under 4 hours | ₦35,000 flat |
| Standard | New tab, new modal, new Firestore collection, new integration — 4 to 16 hours | ₦95,000 flat |
| Major | New module, new app section, third-party API integration — 16 to 40 hours | ₦185,000 flat |
| Enterprise | New standalone app, full module (e.g. payroll), hardware integration — over 40 hours | Quote on request |

**Payment terms:** 50% deposit on written approval, 50% on delivery and acceptance.
**Rush fee:** 30% surcharge for delivery within 72 hours of written approval.
**Retainer option:** ₦150,000/month for up to 20 hours of change order work — unused hours do not roll over.

---

## 5. Acceptance Criteria

A deliverable is accepted when **all** criteria in the relevant section below are met.
Acceptance is confirmed in writing by Bayo Adesanya via WhatsApp or email.

### 5.1 bloom-agent — Accepted When:
- [ ] An agent whose phone is in `admin_agents` can log in on first use with internet connection
- [ ] The same agent can log in on subsequent uses with **no internet connection**
- [ ] An agent whose phone is **not** in `admin_agents` receives the "Number not registered" error and cannot proceed
- [ ] Typing a phone number in the field and pressing Login does not create a new agent record
- [ ] A deal submitted with all required fields (school name, phone, student count, tier) appears in `admin_deals` with status `pending`
- [ ] A deal submitted **offline** is stored in the local queue and reaches Firestore within 30 seconds of internet reconnection
- [ ] The commission preview correctly shows 20% of tier price × number of terms before submission
- [ ] The My Deals tab shows the agent's own deals only, with correct status chips (pending / approved / rejected)
- [ ] The Earnings tab shows totals drawn from `admin_ledger` for that agent's phone number
- [ ] Uploading a clear photo of a handwritten student register returns a name count within ±5 of the actual count
- [ ] Cache-buster `?v=` and sw.js `CACHE_NAME` are in sync and updated on every app.js push

### 5.2 bloom-portal — Accepted When:
- [ ] Login with correct Firebase Auth credentials succeeds and loads the dashboard
- [ ] Login with incorrect credentials shows an error and does not grant access
- [ ] Session expires and requires re-login after 8 hours
- [ ] A pending deal card shows the school name, agent name, student count, tier price, and calculated commission
- [ ] Approving a deal generates a BLOOM-XXXXXX school ID and writes to `schools`, `admin_approved_schools`, and `admin_ledger` in a single operation
- [ ] The WhatsApp message opened on approval contains the correct school ID, password, and portal URL
- [ ] Rejecting a deal changes its status to `rejected` in `admin_deals`
- [ ] Adding an agent writes to `admin_agents` and triggers the WhatsApp activation message dialog
- [ ] Deleting an agent removes the record from `admin_agents` with no residual document
- [ ] The ledger shows all commission entries with correct amounts, agent names, and paid/pending status
- [ ] Marking a commission as paid updates the `paid` field to `true` and shows the Paid chip
- [ ] The CAC fund tracker correctly reflects manual additions and automatic commission allocations
- [ ] The production reset deletes `admin_deals`, `admin_approved_schools`, `admin_ledger`, `admin_activity`, and `admin_alerts` while leaving `admin_agents`, `admin_settings`, `admin_cac`, and `schools` intact

### 5.3 School-Bloom — Accepted When:
- [ ] A school with a valid School ID can log in on first use with internet connection
- [ ] The same school can log in on subsequent uses with **no internet connection**
- [ ] Principal sees all tabs; Bursar does not see staff, health, sports, arts, music, security; Class Teacher sees only their assigned class and sees no fee data; Subject Teacher sees only scorecard and students
- [ ] Adding a student with name and phone number saves the record and increments the student count banner
- [ ] Uploading a CSV with headers (name, phone, class, fee) imports all valid rows and skips blank or malformed rows
- [ ] Recording a payment updates the student's paid balance and adds an entry to payment history
- [ ] Bulk payment CSV import matches student names with fuzzy matching and flags ambiguous matches without updating them
- [ ] Attendance marked as Present/Absent/Late for today persists after a page refresh
- [ ] Score entered in the bulk entry grid is saved and appears in the broadsheet after Save All
- [ ] Report card generated for a student shows correct CA totals, exam scores, total, grade, class position, and teacher/principal signature lines
- [ ] Batch report card print opens a print window with one card per page and a Print All button
- [ ] Health records tab is not visible to Bursar, Class Teacher, or Subject Teacher
- [ ] Principal who visits health tab sees the vault unlock prompt before any records are shown
- [ ] A health record logged by the Principal is stored as ciphertext in Firestore (verified by reading `health` array directly from Firebase Console — no plaintext visible)
- [ ] The same health record is correctly decrypted and displayed after vault unlock with the correct password
- [ ] Entering the wrong password at vault unlock shows an error and displays no records
- [ ] Every health vault unlock, record view, log, and delete writes an entry to `admin_activity` with `t: "health_audit"`
- [ ] All data entered offline syncs to Firestore within 30 seconds of internet reconnection with no data loss
- [ ] Tier-exceeded alert banner appears when student count exceeds the purchased tier maximum
- [ ] App locks and shows upgrade message when grace period (3 days) expires after tier is exceeded

### 5.4 Cross-App — Accepted When:
- [ ] All three production apps load in under 4 seconds on a 3G connection in Lagos
- [ ] All three apps return a Lighthouse PWA score of at least 80
- [ ] All three apps install as a PWA (Add to Home Screen) on Android Chrome
- [ ] No hardcoded API keys, GitHub tokens, or Groq keys appear in any production JS file
- [ ] `esc()` is applied to all user-supplied data before innerHTML assignment in all three apps
- [ ] Cache-buster `?v=` in index.html and `CACHE_NAME` in sw.js match after every push

---

*Document ends.*

*Changes to this document require a written amendment signed by Bayo Adesanya.*
*Next review date: 2026-11-20 (quarterly).*
