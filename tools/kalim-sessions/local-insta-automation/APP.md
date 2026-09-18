# Instagram Lead Desk -- the app

The dashboard is now an application rather than a page you regenerate. It reads
and writes SQLite, it talks to live inventory, and every action happens inline
in the pipeline row you are already looking at. Nothing opens a popup.

```
start-lead-desk.cmd
```

That builds `db/lead-desk.db` from the workbook on first run, then serves
<http://127.0.0.1:8931/>. The equivalent by hand:

```bash
python scripts/migrate_to_sqlite.py      # once, or after an Excel edit
python scripts/lead_desk_app.py          # every time
```

---

## What changed

| Before | Now |
|---|---|
| `master/hp-insta-leads.xlsx` was the source of truth | `db/lead-desk.db` is. The workbook was imported once and is no longer read |
| `build_dashboard_data.py` regenerated a JS file after every change | the page calls the server, so it is never stale |
| Read-only page; actions meant opening a drawer | every action is inline on the row: copy, draft, assign, paste reels, ask |
| One fixed desktop width | one layout that works from a 320px phone to a 1920px monitor |
| Sample flats filled the gap when nothing was connected | sample listings are never displayed |
| One property search, buried in the chat panel | live search in every open row, plus its own Inventory tab |
| Reels were a semicolon string in a cell | first-class rows you can tag with a property id |
| "Sourcing" was three columns on the lead | a real task board, many tasks per lead, with status |

The old page is kept at `legacy/lead-dashboard-static.html` with its stylesheet,
and the old runner at `scripts/lead_desk_server.py`. Neither is used any more.

---

## The pipeline row

Collapsed, a row carries the whole judgement: name, handle, score, the
requirement in one line, whether there is a number, a meeting, reels, an open
task for Sameer and how long the thread has been quiet. Two buttons work
without opening anything:

- **Copy reply** puts the drafted Hinglish reply on the clipboard. Alt-tab to
  Instagram and paste. That is the whole flow.
- **Assign Sameer** opens the row with the assignment form focused and already
  filled from the requirement.

Open a row and you get three lanes side by side.

### 1. Reply

The reply is an editable box, not a read-only blob. **Copy** takes whatever is
in the box, including your edits. **Draft with AI** rewrites it from the whole
thread, the reels and the live inventory; type what the lead just said in the
small box first and the draft answers that specifically. **Save to thread**
writes the exchange into the database, merges what the model learned into the
lead row, and logs every field it changed. **Thread** shows the conversation.

### 2. Reels and requirement

Paste one link or twenty into the box and press Enter. Every Instagram
reel, post or IGTV link in what you pasted is picked out, whether they are on
separate lines, separated by spaces, or buried in a wall of copied text; any
other URL is kept too. Duplicates are ignored, so pasting the same block twice
is harmless.

Tag a link with a property id and it stops being a bookmark: the draft and the
answers are then written about the listing the lead actually saw, and the links
travel with the assignment to Sameer.

Under that, the requirement fields are editable in place. They save when you
leave the box and every change is recorded with its old value.

### 3. Inventory, answers and Sameer

The property search runs the moment you open a row, using that lead's
requirement. Each result gives you three inline actions:

- **Use in reply** appends the real society, area and price to the reply box.
- **Ask about it** answers a question about that specific listing.
- **Assign this** fills Sameer's form with that property id.

**Ask about a property** is the one to understand. Give it a property id -- or
press **Ask** on a tagged reel -- and a question, and it answers from the
property record and nothing else. What the record does not say comes back as
"not in the record" rather than as a guess. You get two things: the facts for
you, and a Hinglish DM you can paste as-is.

**Assign Sameer** creates a task with the configuration, deal type, locality,
budget, the property id if there is one, a priority and your note. The reel
links are attached automatically. **Copy as message** gives you the same thing
as text if you would rather send it on WhatsApp.

---

## The other tabs

**Sourcing** is Sameer's board: every task, newest first, with open /
in progress / done / dropped. Status is yours alone; an import never moves it.

**Inventory** is the same live search without a lead attached. Describe what
you want in plain words.

**Requirements** groups live demand by deal type, configuration and area --
the list to hand a sourcing partner.

**Activity** is messages per day and per week, and the full change history.

**How it works** is the rules, in the app, so nobody has to read this file. It
opens with *what is connected right now*: the account the desk belongs to, the
model in use, which inventory backend answered and what is in the database.

---

## It fits the screen it is on

One layout, five steps, no separate mobile page:

| Width | What changes |
|---|---|
| 1400+ | the three work lanes sit side by side |
| 1400 | lanes go to two columns |
| 1180 | the status strip keeps its dots and labels, drops the values (hover for them) |
| 1024 | lanes go to one column; the row's buttons move to their own line |
| 900 | the side rail collapses to icons |
| 768 | the rail becomes a bottom tab bar and the filters scroll sideways |
| 560 | everything is one column and the row buttons stretch to full width |

Checked at 320, 390, 600, 768, 900, 1024, 1180, 1366, 1536 and 1920 with a row
expanded on every tab: nothing overflows its box, nothing sits on top of
anything else, and the page never scrolls sideways. The account in the corner
is read from `config/fetch-config.json`, not typed into the HTML.

---

## Where the data comes from

```
Instagram DM export ─┐
screenshots          ├─> scripts/ingest_to_db.py ─> db/lead-desk.db ─> the app
master/*.xlsx        ─┘   (see docs/INGESTION.md)
```

Everything is keyed on the lowercase Instagram handle, so a re-run updates a
conversation rather than duplicating it, and messages de-duplicate on handle,
date, time and text. See `docs/INGESTION.md` for what the ingest accepts and
how the incremental check works.

---

## Property search: which backend answers

The app tries these in order and always tells you which one answered, in the
badge on the inventory lane and in the status strip at the top:

1. **The public property API** in `infra/`, if `PROPERTY_API_BASE` is set. This
   is a Lambda with a function URL doing Bedrock Titan embeddings against the
   properties table -- real semantic search, no Cognito token needed. It is not
   deployed by default; see `infra/README.md`.
2. **The CRM directly**, using whichever of `CRM_INTERNAL_API_KEY`,
   `CRM_AUTH_TOKEN` or `CRM_PUBLIC_API_KEY` is in `.env`. Semantic first, then
   exact filters.
3. **Nothing.** If neither answers, the lane says *no live inventory connected*
   and stays empty.

An empty result from the semantic path is not proof that nothing exists -- the
backend returns an empty list rather than an error when its vector index was
never built -- so the app falls through rather than declaring no match.

### Sample listings are never shown

`config/mock-properties.json` still exists so the code paths run with no
credentials, but the desk will not put an invented flat on screen next to a
real conversation, and will not let one reach an AI draft or a property answer.
Search, single-property lookup and the health probe all blank a sample result
and say so instead. Set `ALLOW_SAMPLE_INVENTORY=true` in `.env` if you
deliberately want the sample data back for a demo.

---

## The API, if you want to script it

```
GET  /api/health                     what is configured and which model is in use
GET  /api/bootstrap                  everything the page needs on load
GET  /api/leads/<handle>             lead, thread, reels, tasks, answers, history
POST /api/leads/<handle>/update      {"fields": {"budget": "30k"}}
POST /api/leads/<handle>/reels       {"links": "…paste anything…"}
POST /api/leads/<handle>/draft       {"message": "what the lead just said"}
POST /api/leads/<handle>/save        write the exchange back
POST /api/reels/<id>                 {"property_id": "…"} or {"delete": true}
POST /api/tasks                      assign Sameer
POST /api/tasks/<id>/status          {"status": "done"}
GET  /api/properties/search?q=&lead_id=&locality=&property_type=&deal_type=&budget=
GET  /api/properties/<id>
POST /api/properties/answer          {"lead_id","property_id","question","reel_links"}
```

It binds to `127.0.0.1` only. Credentials stay in `.env` and never reach the
browser.

---

## The database

`db/lead-desk.db`, openable in any SQLite browser. It is gitignored, because it
holds the same real names and phone numbers the workbook did.

| Table | What is in it |
|---|---|
| `leads` | one row per Instagram handle, the columns the workbook had plus `stage` and `owner` |
| `messages` | every DM, with `direction` = lead / business / unknown |
| `changelog` | append-only: every field change, old and new, with what caused it |
| `runs` | one row per import |
| `reels` | links shared in a thread, optionally tagged with a property id |
| `tasks` | Sameer's board |
| `answers` | every property answer, kept so you can see what was told to whom |
| `meta` | where the data was imported from, and when |

Nothing is deleted quietly. Removing a reel writes a changelog row too.
