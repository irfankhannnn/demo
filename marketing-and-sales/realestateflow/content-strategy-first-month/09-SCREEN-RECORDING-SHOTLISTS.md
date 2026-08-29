# 09 - Screen Recording Shot Lists `[REC]`

**This file is for you, not the editor.** It tells you exactly what to record, in what order, for how
long. Record everything in **one sitting** - ideally Friday of week 2 (21 Aug), before the editor
starts on week 3.

Deliver raw files to the editor named `REF-S##-<slug>-RAW.mp4`.

---

## 0. Before you record anything

### 0.1 Set up the demo tenant

Do **not** record your real production tenant. Create or reset a demo tenant with realistic Indian
data. Consistency across all five recordings matters - the editor will intercut them.

**Use this exact dataset so every recording matches:**

| Entity | Sample records to seed |
|--------|------------------------|
| **Leads** | Rohan Mehta (3BHK, Kharadi, ₹1.4 Cr) · Sneha Kulkarni (2BHK, Baner, ₹85 L) · Imran Shaikh (Rental, Andheri W, ₹65k/mo) · Priya Nair (2BHK, Powai, ₹1.1 Cr) · Vikas Jain (Office, BKC, ₹2.8 Cr) - **at least 12 leads total**, mixed statuses |
| **Buyers** | ≥ 8, at least 4 tagged to **Andheri** (needed for R15's query) |
| **Owners** | Suresh Agarwal · Meena Deshpande · Farhan Qureshi · Anil Bhosale |
| **Tenants** | ≥ 5 with active rentals |
| **Properties** | ≥ 10, mixed: 2BHK/3BHK apartments, one office, one plot |
| **Khata entries** | ≥ 9 pending: at least 4 TO_GIVE, 4 TO_TAKE, spread across Security Deposit / Deep Cleaning / Brokerage / Maintenance / Rent |
| **Meetings** | 3 scheduled for "today" |

**Rules for the data:**
- Realistic Indian names and Mumbai/Pune localities. No "John Doe", no "Test User 1".
- Amounts that look like real deals - `₹1.4 Cr`, `₹85,00,000`, `₹65,000/mo`, `₹15,000` deposit.
- **Nothing traceable to a real person.** No real phone numbers - use `98XXX XXXXX` patterns that are
  obviously placeholder, or blur in post.
- Populate enough rows that lists **scroll**. An empty-looking product kills the demo.

### 0.2 Recording setup

| Setting | Value |
|---------|-------|
| Resolution | 1920×1080 minimum (editor crops to 9:16). **Do not** pre-crop. |
| Frame rate | 60fps if possible - smoother zoom-punches in post |
| Cursor | Visible. Move it **deliberately and slowly.** Fast cursor movement is unusable. |
| Browser | Full screen, **hide bookmarks bar, extensions, and any other tabs** |
| Zoom level | Browser at 110-125% - text must be legible after the 9:16 crop |
| Notifications | OS notifications OFF. Do Not Disturb ON. |
| Audio | None needed. VO is added separately. |
| Takes | Record each shot **3 times.** Cheap now, impossible later. |

### 0.3 Golden rules

1. **Pause 1.5 seconds before and after every action.** The editor needs handles to cut on.
2. **Never rush.** Slow, deliberate movement reads as confident. Fast reads as hiding something.
3. **Land the cursor, then click.** Don't click while moving.
4. **Record more than the script asks for.** An extra 10 seconds of the same screen costs nothing.
5. **If it errors or looks broken, re-record.** Never ship a demo with a visible bug or empty state.

---

## S-01 · CRM Dashboard walkthrough
**Used by:** R10 (Wed 26 Aug) · **Record length:** ~60s raw → cut to 24s
**Screen:** `CRMDashboard`

| Sec | What to do | Why |
|-----|-----------|-----|
| 0-3 | **Start with the dashboard already loaded.** Cursor parked bottom-right, still. | Cold open. No login, no navigation - we never show a loading state. |
| 3-8 | Move cursor slowly to the **pipeline / live-deals summary**. Hover over it. Hold 3s. | Editor zoom-punches this into the "kitni deal live hai" beat |
| 8-14 | Move to the **follow-ups due today** block. Hover. Hold 3s. Do not click. | "Aaj kis-kis ko call karna hai" |
| 14-20 | Move to the **money / Khata summary** block. Hover over both To Give and To Take figures. Hold 3s. | "Kiska paisa aana hai, kisko dena hai" |
| 20-26 | Move to **recent activity / team activity**. Scroll it down 2-3 rows slowly, then back up. | "Aapki team ne aaj kya kiya" |
| 26-32 | Return cursor to centre. Sit completely still on the full dashboard for 6 full seconds. | The editor needs a clean wide hold for the closing beat |
| 32-45 | Slowly scroll the whole dashboard down and back up once. | Spare coverage |

**Do not:** open any sub-page, click anything, or show a modal. This recording is the overview only.

---

## S-02 · Khata Book
**Used by:** R12 (Fri 28 Aug) · **Record length:** ~75s raw → cut to 26s
**Screens:** `KhataBook` → `KhataEntryForm` → settlement

| Sec | What to do |
|-----|-----------|
| 0-4 | **Khata Book already open**, showing the summary at top (net balance, To Give total, To Take total). Cursor still. |
| 4-8 | Hover the **net balance** figure. Hold 3s. |
| 8-16 | Click the **To Give** filter. Wait for the list. Let it sit 4s so names, properties and amounts are readable. |
| 16-22 | Scroll the To Give list down slowly, 3-4 rows. Scroll back to top. |
| 22-30 | Click the **To Take** filter. Wait. Hold 4s. Scroll 2 rows and back. |
| 30-40 | Click into **one single entry** - pick one with multiple line items. Let the detail open fully. Hold 5s on the category chips and line items. |
| 40-48 | Show the **reminder** field on that entry - click it, show the date picker open, close it. |
| 48-56 | Show the **Settled** toggle / settlement action. Hover it, hold 3s. **Do not actually settle** unless you're happy for the data to change. |
| 56-65 | Navigate back to the full Khata list. Hold still 5s. |
| 65-75 | Spare: slowly scroll the entire list top to bottom once. |

**Critical:** the categories must be visible and readable on screen - *Security Deposit, Deep
Cleaning, Brokerage, Repair, Maintenance.* Those exact words are what the VO names.

---

## S-03 · ★ The AI Employee conversation (the reveal)
**Used by:** R14 (Mon 31 Aug) - **most important recording of the month**
**Record length:** ~90s raw → cut to 30s
**Screen:** WhatsApp on a **real physical phone**

> **Record this on an actual phone, held in your hand.** Screen-mirror capture or a second camera
> filming the phone both work. An emulator or desktop WhatsApp Web recording will read as fake and
> destroy the credibility of the single best asset we have.

| Sec | What to do |
|-----|-----------|
| 0-4 | WhatsApp open on the AI Employee thread. **Empty or near-empty.** Hold still 4s. |
| 4-12 | Type, **at natural human speed**, letter by letter: `Kitne leads pending hain?` - do not paste. |
| 12-14 | Press send. |
| 14-22 | **Do not touch the phone.** Let the real typing indicator run and the real reply arrive. Whatever the genuine latency is, keep it. |
| 22-32 | Reply is on screen. Hold completely still for 10 seconds so the numbers are readable. |
| 32-42 | Type: `Andheri ke kharidar dikhao` - again, natural speed, letter by letter. |
| 42-44 | Send. |
| 44-52 | Let the real reply arrive. Don't touch anything. |
| 52-64 | Hold on the buyer list for 12 seconds. Scroll it slowly if it's long. |
| 64-75 | Pull the phone back slightly / widen the frame so it's visibly just a normal phone in a normal hand. Hold 8s. |
| 75-90 | Spare: scroll the whole thread from top to bottom slowly. |

**Requirements:**
- Real replies from the real agent. **If a query fails, fix it or change the query - never fake a
  reply.** This reel is the company's credibility.
- Blur or replace anything identifying in post.
- Natural room lighting on the phone. A slight hand tremor is good - it proves it's real.
- Record the **notification/message sounds** if you can; the editor can use them.

**Fallback queries** if either of the two above doesn't return well on the day:
`Aaj ka brief do` · `Pipeline ka summary do` · `Kitni properties hain?` · `Aaj ki meetings dikhao`

---

## S-04 · WhatsApp Se Puchho #1 - "Andheri ke kharidar dikhao"
**Used by:** R15 (Wed 2 Sep) · **Record length:** ~45s raw → cut to 18s

Same setup as S-03. Single query, clean take.

| Sec | What to do |
|-----|-----------|
| 0-3 | Clean thread, phone still |
| 3-10 | Type `Andheri ke kharidar dikhao` at natural speed |
| 10-12 | Send |
| 12-20 | Real wait, real typing indicator |
| 20-34 | Hold on the returned buyer list - 14 seconds. Scroll slowly if needed. Names, budgets, BHK, locality should all be legible. |
| 34-45 | Spare coverage |

**This is episode 1 of the flagship series.** Get a clean take. Record it 4-5 times.

---

## S-05 · WhatsApp Se Puchho #2 - "Aaj ka brief do"
**Used by:** R17 (Fri 4 Sep) · **Record length:** ~45s raw → cut to 19s

Same setup. **Record this one in actual morning light** - the reel sells a morning habit and the
light does half that work.

| Sec | What to do |
|-----|-----------|
| 0-3 | Clean thread, morning light visible on the phone |
| 3-9 | Type `Aaj ka brief do` |
| 9-11 | Send |
| 11-18 | Real wait |
| 18-36 | Hold on the daily brief for 18 seconds. It's a longer reply - the editor needs to zoom-punch through each section (priority leads → follow-ups → meetings → pending money), so hold long. |
| 36-45 | Pull back to show phone-in-hand, morning setting |

---

## S-A1 · Product tease (1.5 second flash)
**Used by:** R09 (Mon 24 Aug) - the thesis reel
**Record length:** 15s raw → cut to **1.5s**

A single, beautiful moment: a question typed into WhatsApp and a structured CRM answer sitting
below it, already on screen. No typing, no wait - just the finished exchange.

| Sec | What to do |
|-----|-----------|
| 0-15 | Open the AI thread on a completed exchange (question + rich reply visible together). Hold the phone still for the full 15 seconds. |

The editor takes 1.5 seconds from the middle. That's all. **Resist the urge to show more in R09** -
that reel sells the idea; R14 sells the product.

---

## Recording day checklist

- [ ] Demo tenant seeded with the §0.1 dataset
- [ ] DND on, notifications off, bookmarks bar hidden
- [ ] Browser at 110-125% zoom
- [ ] Phone charged, on a real WhatsApp account connected to the demo tenant
- [ ] S-01 CRM Dashboard - 3 takes
- [ ] S-02 Khata Book - 3 takes
- [ ] S-03 AI Employee reveal - **5 takes**
- [ ] S-04 WhatsApp Se Puchho #1 - 5 takes
- [ ] S-05 WhatsApp Se Puchho #2 - 3 takes (morning light)
- [ ] S-A1 Product tease - 2 takes
- [ ] All files renamed `REF-S##-<slug>-RAW.mp4`
- [ ] Reviewed every take for: visible bugs, empty states, real personal data, loading spinners
- [ ] Uploaded to the editor's shared folder
