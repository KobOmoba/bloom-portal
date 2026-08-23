# EduBloom Email Infrastructure
AariNAT Company Limited | Last updated: 2026-08-20

---

## Architecture

Two sending domains. Completely isolated from each other.
If marketing emails get spam complaints, receipts are unaffected.
If receipts bounce, marketing reputation is unaffected.

| Domain | Purpose | Provider | Volume |
|--------|---------|----------|--------|
| `pay.edubloom.com.ng` | Payment receipts, school activation confirmations | Resend  | Transactional backup — WhatsApp is primary channel |
| `hello.edubloom.com.ng` | Newsletter, product updates, school tips | Brevo | Marketing — higher volume, unsubscribe managed |

`edubloom.com.ng` itself is never used as a sending domain.
Keeping it clean protects the root domain reputation.

---

## Requirement 1 — SPF and DKIM Records

### pay.edubloom.com.ng (Resend — Email Backup)

> **Note:** WhatsApp via Termii is the PRIMARY receipt channel.
> Resend email is the BACKUP for parents who provide an email address.

Add all five records at your DNS provider (Namecheap / GoDaddy / wherever edubloom.com.ng is registered).

**Step 1 — Get your DKIM key from Resend:**
1. Log into resend.com (free — 3,000 emails/month)
2. Go to: Domains → Add Domain
3. Enter: `pay.edubloom.com.ng`
4. Resend generates your DKIM key — copy it

**Step 2 — Add these DNS records:**

```
TYPE    HOST                                    VALUE
────────────────────────────────────────────────────────────────────────────────
TXT     pay.edubloom.com.ng                     v=spf1 include:_spf.resend.com ~all

TXT     resend._domainkey.pay.edubloom.com.ng       k=rsa; p={YOUR_MAILGUN_DKIM_KEY}
                                                (paste the full key from Mailgun)

TXT     _dmarc.pay.edubloom.com.ng              v=DMARC1; p=quarantine;
                                                rua=mailto:dmarc@pay.edubloom.com.ng;
                                                ruf=mailto:dmarc@pay.edubloom.com.ng;
                                                pct=100; adkim=s; aspf=s

CNAME   click.pay.edubloom.com.ng               click.unsubscribe-sender.resend.com
```

**Step 3 — Verify in Mailgun:**
After adding records, go to Resend → Domains → pay.edubloom.com.ng → Verify.
DNS propagation takes up to 48 hours but usually under 1 hour in Nigeria.

---

### hello.edubloom.com.ng (Brevo — Marketing)

**Step 1 — Get your DKIM key from Brevo:**
1. Log into brevo.com (free account) → Settings → Senders & IP → Domains
2. Click Add a domain → enter `hello.edubloom.com.ng`
3. Brevo generates a selector name (e.g. `mail`) and DKIM public key
4. Copy both

**Step 2 — Add these DNS records:**

```
TYPE    HOST                                    VALUE
────────────────────────────────────────────────────────────────────────────────
TXT     hello.edubloom.com.ng                   v=spf1 include:spf.brevo.com ~all

TXT     {selector}._domainkey.hello.edubloom.com.ng
                                                k=rsa; p={YOUR_BREVO_DKIM_KEY}

TXT     _dmarc.hello.edubloom.com.ng            v=DMARC1; p=reject;
                                                rua=mailto:dmarc@hello.edubloom.com.ng;
                                                pct=100

CNAME   click.hello.edubloom.com.ng             alias.brevo.com
```

**Step 3 — Verify in Brevo:**
Settings → Senders & IP → Domains → Authenticate → Check.

---

## Requirement 2 — Dedicated Sending Domains

Why two separate domains (already covered above, here for reference):

- **pay.edubloom.com.ng** sends only transactional email. Paystack fires a webhook,
  Firebase Function calls Mailgun, receipt lands in inbox. This domain never sends
  bulk email. ISPs (Gmail, Yahoo, Outlook) trust it highly because it only sends
  email people are actively expecting.

- **hello.edubloom.com.ng** sends only marketing email. If a school marks one of
  your newsletters as spam, it affects only this domain's reputation. The receipt
  domain `pay.edubloom.com.ng` is completely insulated.

---

## Requirement 3 — One Domain Per Purpose

| Use case | Sending address | Domain |
|---------|----------------|--------|
| Payment receipt (parent) | receipts@pay.edubloom.com.ng | pay.edubloom.com.ng |
| School activation credentials | welcome@pay.edubloom.com.ng | pay.edubloom.com.ng |
| Password reset | noreply@pay.edubloom.com.ng | pay.edubloom.com.ng |
| Monthly newsletter to principals | hello@hello.edubloom.com.ng | hello.edubloom.com.ng |
| Product updates / new features | updates@hello.edubloom.com.ng | hello.edubloom.com.ng |
| Promotional offers | offers@hello.edubloom.com.ng | hello.edubloom.com.ng |

**Strict rule:** Nothing from `pay.edubloom.com.ng` is ever bulk. One email, one trigger.

---

## Requirement 4 — Delivery Monitoring

### A. Gmail — Google Postmaster Tools
**URL:** https://postmaster.google.com
**What it shows:** Your domain reputation at Google (High / Medium / Low / Bad),
spam rate, delivery errors, authentication pass rate.
**Why:** 70%+ of Nigerian school parent email is Gmail. This is the most important dashboard.

**Setup:**
1. Go to postmaster.google.com
2. Add domain → enter `pay.edubloom.com.ng`
3. Add the TXT verification record Google gives you to your DNS
4. Repeat for `hello.edubloom.com.ng`
Data appears after your first 100 emails to Gmail addresses.

---

### B. Resend Analytics (Email Backup)
**URL:** resend.com → Emails (log of every email sent)
**What it shows:**
- Delivered / Failed / Queued per email
- Bounce rate (hard bounce = bad address, soft bounce = temp issue)
- Spam complaint rate (must stay below 0.1%)
- Open rate and click rate
- Per-email event log: exactly when each receipt was delivered or rejected

**Alerts to set (Mailgun → Webhooks):**
- Bounce → POST to your Firebase Function to flag the student record
- Complaint → POST to log the complaint in admin_activity
- Delivery failure → POST to admin_email_failures (already coded)

---

### C. Microsoft Smart Network Data Services (Outlook/Hotmail)
**URL:** https://sendersupport.olc.protection.outlook.com/pm/
**What it shows:** Reputation at Outlook, Hotmail, Live accounts.
Less relevant for Nigerian school parents but worth setting up.

---

### D. Blacklist Monitoring — MXToolbox
**URL:** https://mxtoolbox.com/blacklists.aspx
**What it shows:** Whether your IP or domain appears on any major spam blacklist.
**How often:** Check weekly for the first 3 months, then monthly.
Set up a free MXToolbox monitor for `pay.edubloom.com.ng` — emails you if you get listed.

---

### E. Pre-Send Testing — Mail-Tester
**URL:** https://www.mail-tester.com
**What it shows:** A score out of 10 for your email setup before you start sending.
**How to use:**
1. Mail-tester gives you a unique test address (e.g. test-abc123@mail-tester.com)
2. Send a sample receipt from Mailgun to that address
3. Go back to mail-tester.com — see your score, exactly what to fix.
**Target score:** 9.5 or above.

---

## Mailgun Firebase Secrets

Before deploying the updated Cloud Function, set these secrets:

```bash
firebase functions:secrets:set PAYSTACK_SECRET_KEY
# (paste your Paystack live secret key)

firebase functions:secrets:set MAILGUN_API_KEY
# (paste your Mailgun Private API Key from mailgun.com → Account → API Keys)
```

Verify secrets are set:
```bash
firebase functions:secrets:list
```

---

## Deploy Checklist

Before going live with email receipts:

- [ ] Resend account created (resend.com — free), `pay.edubloom.com.ng` domain added and verified
- [ ] Brevo account created, `hello.edubloom.com.ng` added and verified
- [ ] All 5 DNS records for `pay.edubloom.com.ng` added and verified in Mailgun
- [ ] All 4 DNS records for `hello.edubloom.com.ng` added and verified in Brevo
- [ ] Google Postmaster Tools domain verified for both domains
- [ ] MXToolbox monitor set for `pay.edubloom.com.ng`
- [ ] TERMII_API_KEY, TERMII_DEVICE_ID, TERMII_TEMPLATE_ID secrets set in Firebase
- [ ] RESEND_API_KEY secret set in Firebase
- [ ] PAYSTACK_SECRET_KEY secret set in Firebase
- [ ] Mail-tester score 9.5+ confirmed for a test receipt
- [ ] Admin email failures collection checked after first 10 live receipts
- [ ] Cloud Functions deployed (`firebase deploy --only functions`)

---

## Cost Estimate

| Service | Free tier | Paid |
|---------|----------|------|
| Resend  | 3,000 emails/month free | $20/month (50k emails) |
| Brevo | 300 emails/day | $25/month (20k emails) |
| Google Postmaster | Free | Free |
| MXToolbox Monitor | Free (1 monitor) | $129/year (unlimited) |

At Stage 1 (5 schools, ~500 parents): Resend free tier is more than enough.
At Stage 3 (50+ schools, ~5,000 parents): still within Resend free tier.
Resend paid only needed above 3,000 emails/month — far beyond Stage 3.

---

*See HEALTH_DATA_COMPLIANCE.md for BAA/DPA requirements related to email data.*
*See EDUBLOOM_PROJECT_SCOPE.md — email delivery monitoring falls under the BloomCollect change order.*
