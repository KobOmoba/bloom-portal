# BloomCollect WhatsApp Receipt — Setup Requirements
AariNAT Company Limited | Last updated: 2026-08-20

---

## What This Gives You

When a parent pays their child's school fee through BloomCollect, they receive an
automatic WhatsApp message within seconds:

> Hello! Payment of *₦51,250* for *Emeka Obi* (Term 2) has been confirmed.
> Reference: BC-BLOOM-ABK001-1724123456789
> Date: 20 August 2026
> Keep this message as your receipt.
> — Educational Bloom

No email. No link to click. Straight to their WhatsApp.

---

## What You Need to Do (In Order)

### STEP 1 — Get a Dedicated EduBloom Phone Number
**Time: 30 minutes**
**Cost: ₦1,500 for a new SIM**

You need a phone number that is NOT your personal number (+234 814 507 3941).
This number will be the sender of every BloomCollect WhatsApp receipt.
Parents will see it as the "Educational Bloom" WhatsApp contact.

Options:
- Buy a new MTN or Airtel SIM (₦1,500 at any outlet)
- Use a VoIP number from Twilio or similar (if you want no physical SIM)

Recommended: buy a new Airtel SIM. Keep it only for EduBloom.
Write down the full number in international format: 234XXXXXXXXXX

---

### STEP 2 — Create a Meta Business Account
**Time: 45 minutes**
**Cost: Free**

1. Go to: https://business.facebook.com
2. Click "Create Account"
3. Enter: AariNAT Company Limited
4. Use your business email: aarinat.company.limited@gmail.com
5. Fill in business details — address, phone, website (edubloom.com.ng)
6. Meta may ask you to verify the business. You may need:
   - Your RC number: RC-1732521
   - A utility bill or bank statement in AariNAT's name
   - Your NIN or BVN (personal identity to verify you own the business)
7. Complete the verification — can take 24–72 hours for approval

Keep your Meta Business Manager ID ready (you will give this to Termii in Step 3).

---

### STEP 3 — Create a Termii Account and Connect WhatsApp
**Time: 1–2 hours + 24 hours for verification**
**Cost: Free to create. WhatsApp messages cost ₦10–15 per message.**

1. Go to: https://termii.com
2. Click "Sign Up" — use your business email
3. Complete KYC:
   - Business name: AariNAT Company Limited
   - RC number: RC-1732521
   - Upload CAC certificate (get from CAC portal if you do not have it)
   - BVN for identity verification
4. Once KYC is approved (usually 24 hours), log into the Termii dashboard
5. In the dashboard go to: Channels → WhatsApp → Connect
6. Termii will walk you through connecting to WhatsApp Business API via Meta
7. You will need your Meta Business Manager ID from Step 2
8. Add the dedicated phone number (from Step 1) as your WhatsApp Business number
9. Meta sends a verification code to that SIM — enter it in Termii
10. Your WhatsApp Business number is now live

Write down from the Termii dashboard:
- Your **API Key** (Settings → API Keys)
- Your **Device ID** (the sender ID for your WhatsApp channel)

---

### STEP 4 — Submit the Message Template to Meta
**Time: 20 minutes to submit + 24–48 hours for Meta approval**
**Cost: Free**

In the Termii dashboard:
1. Go to: Templates → Create Template
2. Fill in exactly:

| Field | Value |
|-------|-------|
| Template Name | bloomcollect_receipt |
| Category | UTILITY (not Marketing) |
| Language | English |

3. Template body — paste this EXACTLY:

```
Hello! Payment of *{{1}}* for *{{2}}* ({{3}}) has been confirmed.
Reference: {{4}}
Date: {{5}}
Keep this message as your receipt.
— Educational Bloom
```

4. Variable samples (Termii asks for examples so Meta can review):

| Variable | Sample value |
|----------|-------------|
| {{1}} | ₦51,250 |
| {{2}} | Emeka Obi |
| {{3}} | Term 2 2026 |
| {{4}} | BC-BLOOM-ABK001-1724123456789 |
| {{5}} | 20 August 2026 |

5. Submit. Meta reviews within 24–48 hours.
6. Once approved, Termii shows you the **Template ID** — write it down.

Important: Submit as UTILITY category, not Marketing.
Utility templates have higher approval rates and lower per-message costs.

---

### STEP 5 — Fund Your Termii Wallet
**Time: 10 minutes**
**Cost: Start with ₦5,000 (covers ~400 WhatsApp messages)**

1. In Termii dashboard go to: Billing → Fund Wallet
2. Pay via card or bank transfer
3. ₦5,000 gives you enough for a full term across 5 schools

Running cost: approximately ₦10–15 per WhatsApp message.
At Stage 1 (5 schools, 100 parents each): ₦5,000–₦7,500 per term.
This cost is covered by EduBloom's 1% BloomCollect fee — it does not come out of your pocket.

---

### STEP 6 — Set Firebase Secrets
**Time: 5 minutes**
**Cost: Free**

On your phone in Termii, get three values:
- API Key (Settings → API Keys → Copy)
- Device ID (Channels → WhatsApp → your channel → Device ID)
- Template ID (Templates → bloomcollect_receipt → ID)

Then run these commands in your Firebase CLI (on a computer or via Expo):

```bash
firebase functions:secrets:set TERMII_API_KEY
# (paste your Termii API key and press Enter)

firebase functions:secrets:set TERMII_DEVICE_ID
# (paste your Termii Device ID and press Enter)

firebase functions:secrets:set TERMII_TEMPLATE_ID
# (paste the approved template ID and press Enter)

firebase functions:secrets:set PAYSTACK_SECRET_KEY
# (paste your Paystack live secret key — if not already set)

firebase functions:secrets:set RESEND_API_KEY
# (paste your Resend API key for backup email receipts)
```

Confirm all secrets are set:
```bash
firebase functions:secrets:list
```

---

### STEP 7 — Deploy the Cloud Function
**Time: 5 minutes**

```bash
cd school-bloom-v2/functions
npm install
firebase deploy --only functions:createPaymentLink,createSubaccount,paystackWebhook
```

---

### STEP 8 — Test Before Going Live
**Time: 30 minutes**

1. Use Paystack's test mode (test API keys, not live)
2. Complete a test payment with your own phone number as the parent
3. Check that WhatsApp message arrives on your phone within 30 seconds
4. Check Firebase Console → admin_whatsapp_failures — should be empty
5. Switch to live Paystack keys and deploy again
6. Do one real ₦100 test payment with a real parent

---

## Summary of Everything Required

| Item | Where | Cost | Time |
|------|-------|------|------|
| New SIM card (dedicated EduBloom number) | Any phone outlet | ₦1,500 | 30 min |
| Meta Business Account | business.facebook.com | Free | 45 min + 72hr verify |
| Termii account + KYC | termii.com | Free | 1hr + 24hr verify |
| WhatsApp Business number on Termii | Termii dashboard | Free | 30 min |
| Meta template approval | Via Termii | Free | 24–48hr |
| Termii wallet funding | Termii billing | ₦5,000 to start | 10 min |
| Firebase secrets set | Firebase CLI | Free | 5 min |
| Cloud Function deploy | Firebase CLI | Free | 5 min |
| Testing | Paystack test mode | Free | 30 min |

**Total cost to launch:** ₦6,500
**Total calendar time:** 3–5 days (mostly waiting for Meta and Termii verification)
**Total active time:** About 4 hours of your time

---

## What Happens After You Do All This

```
Parent pays on Paystack
        ↓ (seconds)
Firebase webhook fires
        ↓
WhatsApp receipt → parent's phone    ← PRIMARY (Termii)
Email receipt → parent's email       ← BACKUP  (Resend, if email was given)
Student paid balance updated         ← School sees it live
AariNAT commission logged            ← You see your 1%
```

---

## Files Changed This Session (Sandbox)

- school-bloom-v2/functions/bloomcollect.js — sendWhatsAppReceipt() added
- bloom-portal/WHATSAPP_SETUP.md — this document
- school-bloom-v2/README.md — updated

Port to production School-Bloom only after all 8 steps above are complete
and testing passes.
