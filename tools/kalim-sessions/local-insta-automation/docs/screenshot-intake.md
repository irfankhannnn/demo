# Handing over a batch of DM screenshots

This is the screenshot route into the lead pipeline. It exists because the Graph API does not
return everything we need and browsing instagram.com with automation risks the account. You
capture the DMs by hand with the screenshot utility, and an agent reads the images.

## What to send

One batch folder, zipped or not:

```
screenshots-dm/
  18-09-2026-9pm/           one capture session, named <DD-MM-YYYY>-<rough time>
    DM-001/ combined.png    one conversation per folder
    DM-002/ combined.png
    ...
```

Nothing else is needed. Do not rename the DM folders, and do not merge two chats into one folder.

## Rules while capturing

1. **One conversation per DM folder.** Press the new-conversation hotkey before each chat.
2. **The first screenshot must include the chat header** — the name and the `handle · Instagram`
   line under it. That handle is the row key for the whole pipeline. Without it the conversation
   is skipped, and the ingest will say which one.
3. **Scroll to the oldest message first, then capture downwards.** Overlap between screenshots is
   fine and expected. Repeated messages are removed twice over: once by the agent reading the
   images, once by `build_parsed_from_fetch.py` on `(date, time, text)`.
4. **Capture any reel or post card in full**, including the author handle across the top. That
   card is usually the lead's opening enquiry.
5. **Do not crop out the date separators.** Messages inherit the date of the separator above them,
   so a cropped separator costs the date for every message under it.
6. **Do not capture two different people's chats in one folder.** The handle is read once per
   folder and applied to every message in it.

## What happens to it

```
DM-NNN/combined.png
  -> agent transcription      -> _processed/transcripts/DM-NNN.json   (one per conversation)
  -> ingest_dm_screenshots.py -> _processed/fetched.json + _processed/reel-links.json
  -> build_parsed_from_fetch  -> parsed.json      (dedup + merge with what the workbook already has)
  -> insta-lead-analyst       -> analysis.json    (score, requirement, next action, Hinglish reply)
  -> upsert_leads_excel.py    -> master/hp-insta-leads.xlsx
```

The screenshots join at the same point the browser fetch does, so everything downstream — the
workbook history merge, the changelog, the dashboard — behaves exactly as it does for a normal run.

## Reel links: the one thing screenshots cannot give us

When a lead shares a reel, Instagram's DM card shows the author handle and a thumbnail. It does
not show a URL, and no amount of screenshot quality will produce one. So every reel found is
listed in `_processed/reel-links.json` with an empty `url`:

```json
{
  "reel_id": "DM-012#1",
  "conversation": "DM-012",
  "lead_handle": "naffiissaa",
  "seen_on": "2026-08-01",
  "author_handle_on_card": "shaikhsameer99",
  "caption_on_card": "Byculla / FORTUNE STAR",
  "our_property_guess": "Fortune Star, Byculla",
  "url": "",
  "property_id": ""
}
```

Open the reel on your phone, copy the link, paste it into `url`, and re-run the ingest. The URL is
planted into the shared-reel message, the parser picks it up into the lead's `reel_links`, and the
analyst can tie the enquiry to a property. Answers are kept between runs, so you only ever fill in
the new ones.

`property_id` is optional. It is the CRM property the reel belongs to, and filling it in is the
same link the agency owner can now set from the property page (the **Instagram Reel Link** field).
Once a property carries its reel, future DMs about that reel match without anyone being asked.

## Privacy

These folders hold real names, phone numbers and conversations. `screenshots-dm/`,
`_processed/` and the transcripts are gitignored. Do not commit them, do not attach them to a
ticket, and do not upload them anywhere outside this machine.
