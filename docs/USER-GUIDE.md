# 📖 Money Meva — User Guide

> Your complete guide to using Money Meva — offline-first personal finance app for Marathi, Hindi, and English users.

---

## 1. Getting Started

### 1.1 First Launch

1. Open Money Meva (web app, installed PWA, or Android app).
2. **Onboarding** asks you to choose your profession — this pre-fills sensible default categories (e.g., salary income, groceries, transport).
3. **Create your profile**: enter a name and set a **4-digit PIN** (10 one-time PINs are generated; each is used once, then rotates).
4. You land on the **Dashboard**.

> All data is stored **on your device first** (IndexedDB). You can use the app fully offline, with no account, no internet, forever.

### 1.2 The PIN system

- PINs protect the app from casual access (e.g., someone picking up your phone).
- After 10 uses, a fresh set of PINs is generated.
- You can change/disable auto-lock under **Settings → PIN Security**.

### 1.3 Language

- Languages: **मराठी (default) · हिन्दी · English**.
- Switch anytime: **Settings → Language**, or the footer of the landing page.

---

## 2. Dashboard Tour

| Section | What it shows |
|---|---|
| Balance card | Current balance carried forward month-to-month |
| Cash flow chart | 6-month income vs expenses trend |
| Spending chart | Where money goes (by category) |
| Goals | Savings goals (e.g., emergency fund) |
| Tasks | To-do items |
| Recurring | Upcoming recurring transactions |
| Reminders | Due reminders |
| Cloud Sync card | Shows sync status + "Sync Now" when connected |

Quick-add works from the dashboard for income, expense, and investment entries.

---

## 3. Transactions

Three transaction types: **Income · Expense · Investment**.

- **Add**: tap the + button (or Quick Add). Date, category, amount, description, partner optional.
- **Future dates are blocked** — you cannot record entries dated after today (recurring schedules and investment maturity dates are exempt).
- **Edit/Delete**: tap an entry (mobile) or row action (desktop).
- **Delete is soft** — items move to **Archive**, and are permanently removed only after 30 days.
- **Search & filter** by category, date, or amount; **group** by day/week/month.

### Investments

- Tracks FD, SIP, RD, PPF and more with a built-in **calculator** (`/dashboard/investments`).
- Goal **contribute** = expense transaction; **withdraw** = income transaction.

### Partners

- Groups: **Customer / Vendor / Contact**.
- Per-partner profit & loss, mini-ledger, and transaction history.

### Recurring

- Daily, weekly, monthly, yearly, or custom frequencies.
- **Advance** creates the transaction and rolls the next date.

---

## 4. Categories

- **Three separate lists**: Income / Expense / Investment categories.
- Add, edit, or delete categories under **Settings → Categories**.
- Changes are saved in a batch, protected by your PIN.
- New categories appear in every transaction dropdown.

---

## 5. Cloud Sync (Optional, Recommended)

> Sync backs up your data to a private cloud space and keeps all your devices in sync. Requires internet. Works independently of local usage — the app always works offline.

### 5.1 Create your cloud account (first device)

1. Open **Settings → Multi-Device Sync**.
2. The **Supabase URL** and **anon key** are already filled in — leave them as-is (the app is pre-configured).
3. Enter **your email** + **password** (min 6 characters).
4. Tap **Create account & sync**.
5. Done — your data is now backed up to the cloud.

### 5.2 Add another device

1. On the second device, open **Settings → Multi-Device Sync**.
2. Enter the **same email + password**.
3. Tap **Connect**.
4. Your cloud data appears on this device. From now on, changes sync live between devices.

### 5.3 Everyday sync behavior

- Sync runs **automatically in the background** (live sync) while connected.
- **Sync Now** forces an instant push + pull (useful after offline edits).
- **Disconnect** stops syncing this device — your local data stays on the device.
- If you change your password or log in on a new device, re-connect with the new credentials.

### 5.4 Privacy of cloud data

- Every account gets a **private, isolated space** enforced by the database (per-user security) — no account can read or change another account's data.
- Your email + password **are** the protection — never share them.
- The anon key is **public by design** (it only enables sign-up/sign-in; it cannot read any user's data).

### 5.5 Advanced: bring your own server

- In **Settings → Multi-Device Sync** you can paste your **own Supabase URL + anon key** to use a completely different database (e.g., your own Supabase project). See `CLOUD-SYNC-GUIDE.md` for owner setup steps.

---

## 6. Export & Import

Export anytime from **Settings → Export/Import**:

| Format | What you get |
|---|---|
| **JSON** | Full backup — use for restore/migration |
| **PDF** | Printable report |
| **Excel** | Spreadsheet for analysis |

Import a JSON backup to restore data on a new device (alternative to cloud sync).

---

## 7. Security & Privacy

- **Local-first**: all data lives in your browser/device storage by default.
- **PINs** guard app access; auto-lock after inactivity (configurable 1h–24h or off).
- **Soft delete + Archive** (30-day retention) protects against accidental deletion.
- **No ads, no trackers, no analytics** — your data is not sold or shared.
- Only when **you** enable cloud sync does an encrypted-in-transit copy live on the shared cloud database, isolated per account.
- The app has **no server of its own** — nothing to track you even when you use cloud sync.

Full policy: see **Terms** and **Privacy** pages in the app (`/terms`, `/privacy`).

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| Forgot my PIN | Data is encrypted by your PIN; restore from your last **JSON backup** (Settings → Export/Import). |
| Sync says "Connect" but I created an account before | Enter your email + password and tap **Create account & sync** again — it connects if the account exists. |
| Sign-in says invalid credentials | Make sure you are using the account you created (same email), and the password is correct. |
| Data missing on another device | Confirm both devices use the **same email + password**, and tap **Sync Now** on the device that has the data. |
| Syncing but nothing changes | Check internet; tap **Sync Now**; wait a few seconds for real-time events. |
| Want to stop syncing | **Disconnect** in Settings — local data is untouched. |
| Password / email already in use | That account already exists — just tap **Connect** with its credentials. |

---

## 9. FAQ

**Q: Is an account required?**
No. The app works fully offline without any account. Cloud sync is optional.

**Q: Is my cloud data shared with other users?**
No. Every account is isolated by the database security model (Row-Level Security). Other users literally cannot query your rows.

**Q: Can I use my own database?**
Yes — paste your own Supabase URL + anon key in Settings (advanced). See `CLOUD-SYNC-GUIDE.md`.

**Q: What happens if I delete the app/clear browser data?**
Local data is removed. If cloud sync was on, reinstall → Connect → your data comes back.

**Q: Which devices are supported?**
Any modern browser (mobile/desktop), installable PWA, and the Android APK (Capacitor). iOS via browser/PWA.

**Q: Is the app free?**
Yes. Money Meva is free, no ads, no subscription.

---

## 10. Getting Help

- **Support page** in the app: Settings → Support
- Email: **support@moneymeva.com**
- Telegram: **@marathimeva**
- Owner/developer docs: `README.md`, `CLOUD-SYNC-GUIDE.md`, and the `docs/` vault.

---

#money-meva #guide #user
