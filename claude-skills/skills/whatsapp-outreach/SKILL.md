---
name: whatsapp-outreach
description: >
  Create WhatsApp voice message scripts, text templates, and automated outreach
  sequences in Hinglish for RealtyFlow. Generates voice scripts for ElevenLabs
  TTS synthesis, WhatsApp Business API templates, and cold calling scripts.
  Use for any WhatsApp, voice, or phone-based outreach.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# WhatsApp & Voice Outreach — RealtyFlow

Create outreach content for WhatsApp, voice messages, and phone calls. Brief: $ARGUMENTS

## WhatsApp Voice Message Scripts (ElevenLabs TTS)

### Script Format
```markdown
## Voice Message: [Name] (Duration: ~30s)

**Voice Profile:** Dev (Casual Indian English) or Priya (Energetic Indian)
**ElevenLabs Settings:** ugc_casual (stability: 0.3, similarity: 0.6, style: 0.7)
**Tone:** Friendly, conversational, like talking to a friend on WhatsApp

### Script (Hinglish):
"Namaste [Name] bhai! Main [Sender] bol raha hoon RealtyFlow se.
Dekho, maine notice kiya ki aapki agency [City] mein kaafi accha kaam kar rahi hai.
Ek cheez batao — aap apne leads kaise track karte ho? WhatsApp groups mein ya Excel mein?

Humne ek CRM banaya hai specifically real estate agencies ke liye.
Bahut simple hai — ek click mein saari leads dikhengi, follow-ups automatic honge,
aur koi deal haath se nahi niklegi.

Agar 2 minute ka demo dekhna ho toh bas reply karo 'DEMO'.
Bilkul free hai, koi commitment nahi. Chalo, talk soon!"
```

### 3 Voice Message Templates

**Message 1: Introduction (30s)**
```
"Hi [Name]! [Sender] here from RealtyFlow.
Maine dekha [Company] kaafi grow kar rahi hai [City] mein — congratulations!
Quick question — aapki team leads kaise manage karti hai abhi?
Humne ek CRM banaya hai jo specifically real estate ke liye hai.
Reply karo 'INFO' agar interest hai, main detail bhej dunga.
No pressure yaar, bas sharing because I think it'll help!"
```

**Message 2: Value Proposition (30s)**
```
"Hey [Name], [Sender] again from RealtyFlow.
Ek interesting baat batata hoon — [Similar Company] jo [City] mein hai,
unhone RealtyFlow use karke apni closing rate 5% se 18% tak badha li.
Kaise? Simple — automatic follow-ups, buyer-property matching, aur zero missed leads.
Aapke liye bhi kaam karega. Demo dekhoge? Sirf 15 minutes lagenge.
Reply karo 'YES' — I'll set it up!"
```

**Message 3: Soft Close (30s)**
```
"Namaste [Name]! Last message from my side.
Maine pichle hafta [Company] ke baare mein baat ki thi RealtyFlow ke liye.
Dekho, agar ab sahi time nahi hai toh koi baat nahi — I totally understand.
Bas ek free guide bhej raha hoon — '5 Follow-Up Mistakes Jo Agents Ko Crores Cost Karti Hain'.
Useful hai chahe RealtyFlow use karo ya na karo. Link neeche hai.
Best of luck bhai! Kisi bhi time connect kar sakte ho."
```

## ElevenLabs TTS Generation

### Generate Voice Messages
```powershell
# Use the ElevenLabs TTS script
.\claude-skills\scripts\elevenlabs-tts.ps1 `
  -Text "Namaste bhai! Main RealtyFlow se bol raha hoon..." `
  -VoiceId "dev-casual" `
  -Preset "ugc_casual" `
  -Output "marketing-and-sales/outreach/voice/intro-message.mp3"
```

## Cold Call Script (Hinglish)

```markdown
## Cold Call Script: RealtyFlow Demo Booking

### Opening (10s)
"Hello, [Name] ji? Main [Sender] bol raha hoon RealtyFlow se.
Aapka 2 minute hai? Bahut quick baat hai."

### Permission (5s)
[If yes] "Thank you! Bahut short rakhta hoon."
[If no] "Koi baat nahi, kab call kar sakta hoon? Main schedule kar leta hoon."

### Problem Statement (15s)
"[Name] ji, hum real estate agencies ke saath kaam karte hain [City] mein.
Ek common problem dekhte hain — leads WhatsApp mein kho jaati hain,
follow-ups miss ho jaate hain, aur team ko pata nahi hota ki kaunsa client
serious hai. Kya aapki team ko bhi yeh face hota hai?"

### Pitch (20s)
[If they relate to the problem]
"Exactly, yahi reason hai humne RealtyFlow banaya.
Yeh ek CRM hai jo specifically real estate ke liye designed hai.
Ek dashboard mein saari leads, automatic follow-up reminders,
aur buyer-property matching. [Similar Company] ne ise use karke
apni sales 40% badhaayi hai ek quarter mein."

### Close (10s)
"Main aapko ek 15-minute demo dikhata hoon — aapki team ke liye customize karunga.
Kal [time] ya [time] — kaunsa better hai aapke liye?"

### Objection Handling
| Objection | Response |
|-----------|----------|
| "Hum already CRM use karte hain" | "Accha, kaunsa? Bahut agencies switch karti hain kyunki generic CRMs mein real estate features nahi hote. Quick comparison dikhata hoon?" |
| "Budget nahi hai abhi" | "Samajh gaya. Humara free tier hai unlimited leads ke saath. Trial free hai, koi card nahi chahiye." |
| "Mujhe sochna hai" | "Bilkul, take your time. Main ek case study bhej deta hoon email pe — [Similar Company] ki success story. Kal ya parso follow-up karun?" |
| "Send WhatsApp pe" | "Sure! Abhi bhejta hoon. Ek 2-minute video demo bhi bhejun saath mein?" |
```

## WhatsApp Business API Templates

### Template 1: Welcome (After Lead Capture)
```
*Welcome to RealtyFlow!* 🏠

Hi {{1}}, thanks for showing interest!

Aapke liye ek personalized demo ready hai. Kab convenient hai?

Reply with a time:
1️⃣ Today
2️⃣ Tomorrow
3️⃣ This week

Ya direct book karo: {{2}}
```

### Template 2: Follow-Up (After Demo)
```
Hi {{1}}, {{2}} here from RealtyFlow!

Demo kaisa laga? Koi questions hain toh poocho.

Quick reminder — aapka free trial 14 din ka hai.
Abhi start karo: {{3}}

Need help setting up? Main personally guide karunga! 💪
```

## Email Templates (Instantly/AWS SES)

### Email 1: Introduction
```
Subject: [Company] + Real Estate CRM (quick thought)

Hi [Name],

Maine dekha [Company] [City] mein kaafi active hai — [X projects/listings].

Quick question — aap leads kaise track karte ho?

Most agencies I talk to WhatsApp groups ya Excel use karti hain.
Problem yeh hai ki 100+ leads ke baad sab messy ho jaata hai.

RealtyFlow specifically real estate ke liye bana hai. Ek demo?

Best,
[Sender]
```

### Email 2: Social Proof
```
Subject: Re: [Company] + Real Estate CRM

Hi [Name],

[Similar Company] [City] mein same situation mein thi:
- 200+ leads spread across WhatsApp groups
- Team members duplicating efforts
- No idea which buyers were serious

RealtyFlow ke baad:
- Lead response time: 48 hours → 15 minutes
- Close rate: 5% → 16%
- Admin time saved: 12 hours/week

Worth a 15-min chat?

[Sender]
```

### Email 3: Value Drop (Final)
```
Subject: For your reference — no reply needed

Hi [Name],

Last message from me. Maine ek guide banayi hai:
"5 Follow-Up Mistakes Jo Real Estate Teams Ko ₹1 Crore+ Cost Karti Hain"

[Link]

Useful hai whether ya nahi RealtyFlow use karo.

All the best yaar,
[Sender]

P.S. Kabhi CRM ke baare mein baat karni ho: [booking link]
```

## Instantly Email Sequence Config

```json
{
  "sequence_name": "RealtyFlow — Mumbai Agencies",
  "steps": [
    { "type": "email", "template": "intro", "delay_days": 0 },
    { "type": "email", "template": "social_proof", "delay_days": 3 },
    { "type": "email", "template": "value_drop", "delay_days": 7 }
  ],
  "settings": {
    "daily_limit": 50,
    "sending_window": { "start": "09:00", "end": "18:00", "timezone": "Asia/Kolkata" },
    "stop_on_reply": true,
    "track_opens": true,
    "track_clicks": true
  }
}
```

## Environment Variables Required
- `ELEVENLABS_API_KEY` — ElevenLabs API key for TTS voice generation
- `WHATSAPP_BUSINESS_API_TOKEN` — WhatsApp Business API access token
- `WHATSAPP_PHONE_NUMBER_ID` — Registered phone number ID
- `INSTANTLY_API_KEY` — Instantly.ai API key for email sequences (or use AWS SES)
- `AWS_SES_REGION` — AWS SES region for email sending

## Output

Save to `marketing-and-sales/outreach/`:
- `voice/` — Voice message scripts + generated MP3s
- `whatsapp/` — WhatsApp templates + API configs
- `email/` — Email sequences + Instantly configs
- `calls/` — Cold call scripts
