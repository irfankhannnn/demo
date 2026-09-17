# Hook Library — 1,000 Hooks

**1,000 reusable Instagram hooks** for RealEstateFlow, each with a stable ID `HK-<CATEGORY>-NNN`. Hooks are the first 1–2 seconds of a reel — the scroll-stopper. Machine-readable copy in [`hooks.json`](hooks.json) — the two files are one dataset in two formats and must be edited together.

> Voice: Hinglish 70/30 (70% English, 30% romanized Hindi — `CLAUDE.md`, brand kit v3), street-smart broker energy. Each hook is tagged with a `language` (`hi-dominant` / `mixed` / `en-leaning` / `mr-dominant`) and `best_frameworks` (`FW-*`, defined in [`../framework-library.md`](../framework-library.md)). The production pipeline ([`../production-pipeline.md`](../production-pipeline.md)) pulls a hook at **Step 4** whose category + framework + language match the piece.

**Claims.** Every hook must pass [`../../10-audience-and-voice/claims-and-proof-policy.md`](../../10-audience-and-voice/claims-and-proof-policy.md): no customer stories, no testimonials, no unsourced % or ₹ figures. The pre-launch pattern is to hand the viewer a question they answer with their own numbers, not a statistic we cannot source. Three hooks carry the `{{entry_price}}` token, resolved from [`../../pricing.json`](../../pricing.json); never hardcode a price.

### What changed from the June draft

| Fix | Records |
|---|---|
| `FW-REVENUE` / `FW-SALES` / `FW-AGENCY-GROWTH` / `FW-REAL-ESTATE` were never defined — remapped to `FW-LEAD-LEAKAGE` / `FW-FOLLOWUP` / `FW-TEAM` / `FW-AUTHORITY` | 275 |
| Devanagari characters stuck inside romanized words (an encoding glitch that broke subtitles) — transliterated to Latin | 30 |
| Fabricated results and first-person testimony — rewritten as questions | 8 |
| Unsourced % / ₹ figures — rewritten as questions, or tokenised | 33 |

### Gated subsets (do not resolve these here)

| Subset | Detail | Gate |
|---|---|---|
| Language tags | 686 hooks are tagged `hi-dominant` against the 70/30 English-led brand rule. Re-tagging is cheap; regenerating is not. | **D24** |
| Pune references (8) | `HK-SALES-039`, `HK-REAL-ESTATE-010/027/042/050/059/078/083` | M1 is Mumbai-only. **D24** |
| AI category (83) | 15 hooks name AI calling, which is not on the approved-claims list. The approved AI claim today is the WhatsApp AI Employee. | **D26** |

> Open decision D24 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`
> Open decision D26 — see `marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md`

## How to use
1. Pick your **content type** (`CT-*`) and **framework** (`FW-*`).
2. Pull a hook whose `category` fits the angle and whose `best_frameworks` include your `FW-*`.
3. Match the `language` tag to [`../../10-audience-and-voice/language-and-tone.md`](../../10-audience-and-voice/language-and-tone.md) for that persona and format.
4. The hook becomes line 1 of the script + the on-screen text in the first second + (often) the caption opener.

## Hook structure patterns (cheat-sheet)
- **Question hook:** "Tumhe pata hai abhi tumhari team kya kar rahi hai?"
- **Loss/number hook:** "100 leads aaye — kitne ka pata hai?" (the viewer supplies the number, we never assert one)
- **Contrarian hook:** "Market down nahi, tumhari leakage problem hai."
- **Stop hook:** "Stop losing commissions to forgotten follow-ups."
- **POV/story hook:** "Raat ko lead aaya, subah tak woh kisi aur ke paas."
- **Curiosity hook:** "Ek 'agent' jo kabhi thakta nahi, 24/7 call karta hai…"

## Category counts

| Category | Count |
|---|---|
| FEAR | 83 |
| CURIOSITY | 83 |
| REVENUE | 83 |
| SALES | 83 |
| LEAD-MANAGEMENT | 83 |
| CRM | 83 |
| AI | 83 |
| REAL-ESTATE | 84 |
| AGENCY-GROWTH | 83 |
| WHATSAPP-CHAOS | 84 |
| TEAM-MANAGEMENT | 84 |
| PROPERTY-MANAGEMENT | 84 |
| **TOTAL** | **1000** |

---

## FEAR (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-FEAR-001 | Aaj jo lead aaya tha, woh kal kisi aur ke paas hoga. | mixed | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-002 | Tumhare kitne leads chup-chaap mar rahe hain? Aaj tak kisi ne gina? | mixed | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-003 | Jis din tumhara best agent resign karega, saara data uske phone mein chala jayega. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-004 | WhatsApp delete ho gaya toh 6 mahine ki leads gayi. | mixed | FW-FEAR, FW-WHATSAPP-CHAOS |
| HK-FEAR-005 | Ek follow-up bhoole, ek deal gayi — har hafte yahi ho raha hai. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-006 | Client ne 3 baar call kiya, tumne dekha nahi — woh ab dusre broker ke saath hai. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-007 | Excel corrupt ho gaya toh? Poora business ek file mein hai. | mixed | FW-FEAR, FW-CRM |
| HK-FEAR-008 | Stop losing commissions to forgotten follow-ups. Apna last miss yaad hai? | en-leaning | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-009 | Tumhara competitor isliye jeet raha hai kyunki woh leads bhoolta nahi. | mixed | FW-FEAR, FW-CONTRARIAN |
| HK-FEAR-010 | Agent ke jaate hi clients bhi chale jaate hain — kyunki data uska tha, tumhara nahi. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-011 | Har miss call ek lost deal hai. Aaj kitne miss hue? | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-012 | Tum so rahe ho, aur tumhari hot lead dusre ko message kar rahi hai. | hi-dominant | FW-FEAR, FW-WHATSAPP-CHAOS |
| HK-FEAR-013 | Commission ka hisaab yaad se rakhte ho? Ek din bada jhagda hoga. | hi-dominant | FW-FEAR |
| HK-FEAR-014 | Site visit ka time bhool gaye? Client ne note kiya — trust gaya. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-015 | 100 leads aaye, 95 ka pata hi nahi kahan gaye. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-016 | Jo broker leads track nahi karta, woh 2 saal mein band ho jaata hai. | mixed | FW-FEAR, FW-CONTRARIAN |
| HK-FEAR-017 | Your phone got stolen. Where are your last 200 leads? | en-leaning | FW-FEAR, FW-WHATSAPP-CHAOS |
| HK-FEAR-018 | Junior agent ne galti se lead delete kar di — ab koi backup nahi. | mixed | FW-FEAR, FW-TEAM |
| HK-FEAR-019 | Tumhe lagta hai sab control mein hai — jab tak ek bada lead miss nahi hota. | hi-dominant | FW-FEAR |
| HK-FEAR-020 | Diwali ke leads abhi tak follow-up ke wait mein hain. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-021 | Client ka naam yaad nahi aaya call pe — deal wahi mar gayi. | hi-dominant | FW-FEAR, FW-PROPERTY |
| HK-FEAR-022 | Tum jise 'busy' kehte ho, woh actually 'disorganized' hai. | mixed | FW-FEAR, FW-CONTRARIAN |
| HK-FEAR-023 | Ek lakh ki deal, ek bhooli follow-up se gayi. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-024 | Tumhari team kya kar rahi hai? Sach mein pata hai? | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-025 | Jab tak system nahi, tab tak tumhara business tumhare memory pe chal raha hai. | mixed | FW-FEAR, FW-CRM |
| HK-FEAR-026 | Broker bhai, lead nahi convert ho rahi — ya tum follow-up hi nahi kar rahe? | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-027 | Agla agent jo nikalega, woh tumhare clients ka WhatsApp group bana lega. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-028 | Tumhara hot lead ab 'thanda' ho gaya — kyunki 3 din reply nahi kiya. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-029 | Manual hisaab ka matlab — ek din koi tumhara paisa kha jayega. | hi-dominant | FW-FEAR |
| HK-FEAR-030 | Tumhe nahi pata kaun sa agent kaun sa lead chala raha hai — ye dangerous hai. | mixed | FW-FEAR, FW-TEAM |
| HK-FEAR-031 | Aaj market down hai, par tumhari real problem leakage hai, market nahi. | mixed | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-032 | Woh deal jo 'pakki' thi — follow-up na hone se competitor le gaya. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-033 | Tumhare diary ke leads aur tumhare dimaag ke leads — dono leak ho rahe hain. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-034 | Office mein 5 agent, par ek bhi report nahi — ye chalta business nahi, jua hai. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-035 | Tumhari biggest deal abhi 'pending' mein dabi padi hai. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-036 | Client ne pucha 'us flat ka kya hua?' — aur tum blank ho gaye. | hi-dominant | FW-FEAR, FW-PROPERTY |
| HK-FEAR-037 | Jis lead pe 2 ghante lagaye, woh follow-up ke bina waste ho gaya. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-038 | Tumhara competitor AI se call kar raha hai, tum abhi 'baad mein karunga' bol rahe ho. | mixed | FW-FEAR, FW-AI |
| HK-FEAR-039 | Ek galat commission split — aur partner ke saath rishta khatam. | hi-dominant | FW-FEAR |
| HK-FEAR-040 | Tumhare paas leads hain, system nahi — isliye paisa table pe chhod rahe ho. | mixed | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-041 | Phone format kiya aur 4 mahine ki mehnat udd gayi. | hi-dominant | FW-FEAR, FW-WHATSAPP-CHAOS |
| HK-FEAR-042 | Jo broker bolta hai 'mujhe sab yaad rehta hai' — usi ke sabse zyada deal miss hote hain. | mixed | FW-FEAR, FW-CONTRARIAN |
| HK-FEAR-043 | Tumhari pipeline khaali nahi hai — tum dekh nahi paa rahe. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-044 | Aaj ka miss follow-up, agle mahine ki khaali EMI ban jaata hai. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-045 | Team ka koi banda fraud kar raha ho toh tumhe 6 mahine baad pata chalega. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-046 | Jab client wapas aata hai aur tumhe yaad hi nahi — woh sharminda tum hote ho. | hi-dominant | FW-FEAR, FW-PROPERTY |
| HK-FEAR-047 | Bina CRM ke business badhana — bina brake ki gaadi chalana hai. | hi-dominant | FW-FEAR, FW-CRM |
| HK-FEAR-048 | Tumhara sabse mehnati agent thak ke chala jayega, agar system nahi diya. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-049 | Har 'main baad mein call karunga' ek dafan ho chuki deal hai. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-050 | Client ka budget yaad nahi, requirement yaad nahi — phir deal kaise? | hi-dominant | FW-FEAR, FW-PROPERTY |
| HK-FEAR-051 | Tumhe lagta hai tum bach gaye — actually tum count hi nahi kar rahe nuksaan. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-052 | WhatsApp pe '200 unread' ka matlab — kam se kam 5 deal dabi hui hain. | mixed | FW-FEAR, FW-WHATSAPP-CHAOS |
| HK-FEAR-053 | Jis din audit hua, manual khata tumhe pareshaani mein daal dega. | hi-dominant | FW-FEAR |
| HK-FEAR-054 | Tumhari memory CRM nahi hai — aur memory dhokha deti hai. | mixed | FW-FEAR, FW-CRM |
| HK-FEAR-055 | Lead aaya 9 baje, tumne dekha 6 baje — deal gayi 9:15 pe. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-056 | Tumhara purana agent ab tumhara competitor hai — tumhare hi data se. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-057 | Stop trusting your memory with your biggest deal. | en-leaning | FW-FEAR, FW-CRM |
| HK-FEAR-058 | Site visit ke baad follow-up nahi kiya? Tumne visit ka paisa jaaya kar diya. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-059 | Tum jitna 'sab theek hai' bologe, utna leakage badhega. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-060 | Ek client ka double booking — aur tumhari reputation gayi. | hi-dominant | FW-FEAR, FW-PROPERTY |
| HK-FEAR-061 | Tumhare diary ke pages girte hain, tumhare deals ke saath. | hi-dominant | FW-FEAR, FW-CRM |
| HK-FEAR-062 | Jab tak hisaab clear nahi, har settlement ek tension hai. | hi-dominant | FW-FEAR |
| HK-FEAR-063 | Tum 50 leads pe ghoom rahe ho, 450 ka kya hua? | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-064 | Tumhara agent bola 'follow-up kiya' — par proof kahan hai? | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-065 | Client ne dusre broker se flat liya — woh roz follow-up karta tha, tum nahi. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-066 | Tumhari pipeline mein kitne 'maybe' hain? Maybe se EMI nahi bharti. | mixed | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-067 | Bina record ke kaam karna — apne hi paer pe kulhadi. | hi-dominant | FW-FEAR, FW-CRM |
| HK-FEAR-068 | Agent resign, data gone, clients gone — ek hi din mein. | mixed | FW-FEAR, FW-TEAM |
| HK-FEAR-069 | Tumne lead ko 'achha follow-up karunga' bola tha — 11 din ho gaye. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-070 | Excel sheet kisi ne edit kar di — ab sahi number kaunsa hai? | hi-dominant | FW-FEAR, FW-CRM |
| HK-FEAR-071 | Tumhare sabse mehnge leads sabse zyada ignore hote hain. | mixed | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-072 | Jab tak chalta hai chalne do — yahi soch dukaan band karwati hai. | hi-dominant | FW-FEAR, FW-CONTRARIAN |
| HK-FEAR-073 | Tumhara competitor tumhare miss kiye leads pakad raha hai. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-074 | Phone gum gaya toh business gum gaya — ye reality hai. | hi-dominant | FW-FEAR, FW-WHATSAPP-CHAOS |
| HK-FEAR-075 | Tum jise organization bolte ho, woh actually 6 WhatsApp groups hain. | mixed | FW-FEAR, FW-WHATSAPP-CHAOS |
| HK-FEAR-076 | Client wapas aaya 8 mahine baad — tumhe yaad nahi, deal gayi. | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-077 | Har unattended lead ek silent NO hai. | mixed | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-078 | Tumhe lagta hai tum agent ko trust karte ho — par data kahan hai? | hi-dominant | FW-FEAR, FW-TEAM |
| HK-FEAR-079 | Manual follow-up scale nahi hota — ek din tum collapse karoge. | mixed | FW-FEAR, FW-AI |
| HK-FEAR-080 | Tumhari aaj ki laaparwahi, kal ki khaali pipeline hai. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-081 | Jo lead tumne 'junk' samjha, woh competitor ka best client ban gaya. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-FEAR-082 | Tumhe deal nahi mil rahi — ya tum yaad nahi rakh paa rahe? | hi-dominant | FW-FEAR, FW-FOLLOWUP |
| HK-FEAR-083 | Jis lead pe tum aaj nahi, competitor kal pahunch jayega. | hi-dominant | FW-FEAR, FW-FOLLOWUP |

## CURIOSITY (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-CURIOSITY-001 | Ek setting jo tumhare follow-up count badal sakti hai — guess karo kaunsi. | mixed | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-002 | Mumbai ka ek broker 200 leads ek aadmi se handle karta hai. Kaise? | mixed | FW-CURIOSITY, FW-CASE |
| HK-CURIOSITY-003 | Maine apne saare WhatsApp leads ek jagah daal diye — phir jo hua... | hi-dominant | FW-CURIOSITY, FW-WHATSAPP-CHAOS |
| HK-CURIOSITY-004 | AI ne raat 2 baje mere client ko call kiya. Subah deal pakki thi. | mixed | FW-CURIOSITY, FW-AI |
| HK-CURIOSITY-005 | Top brokers ye ek cheez chhupa ke rakhte hain. | mixed | FW-CURIOSITY, FW-AUTHORITY |
| HK-CURIOSITY-006 | Zyadatar agents isko galat kar rahe hain — tum bhi? | mixed | FW-CURIOSITY, FW-MISTAKE |
| HK-CURIOSITY-007 | Excel chhodne se income badhegi? Pehle apne pichhle mahine ke follow-up gino. | mixed | FW-CURIOSITY, FW-BAB |
| HK-CURIOSITY-008 | Iss ek button se commission ka jhagda khatam ho jaata hai. | hi-dominant | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-009 | Tumhare phone mein chhupi hui ek deal hai — dikhau kahan? | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-010 | Site visits double karne ke liye extra staff chahiye, ya sirf ek follow-up system? | mixed | FW-CURIOSITY, FW-CASE |
| HK-CURIOSITY-011 | Ye number dekh ke tum hil jaoge: kitne leads tum daily lose karte ho. | mixed | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-012 | Maine ek mahine apne agents ko track kiya. Result shocking tha. | mixed | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-013 | Iska naam koi nahi leta, par har top broker isko use karta hai. | hi-dominant | FW-CURIOSITY, FW-AUTHORITY |
| HK-CURIOSITY-014 | 3 tap mein property share — phir client ka jawab dekho. | hi-dominant | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-015 | Jo broker kabhi follow-up nahi bhoolta — uska secret ye hai. | mixed | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-016 | Maine ye 30 din try kiya. Ab wapas nahi ja sakta. | mixed | FW-CURIOSITY, FW-CUSTOMER |
| HK-CURIOSITY-017 | Ek question jo har client poochta hai — aur tumhara jawab 2 second mein hona chahiye. | hi-dominant | FW-CURIOSITY, FW-PROPERTY |
| HK-CURIOSITY-018 | Tumhe lagta hai CRM mahanga hai? Iski keemat dekho. | mixed | FW-CURIOSITY, FW-OBJECTION |
| HK-CURIOSITY-019 | Iss feature ke baare mein agents ko pata hi nahi — par game changer hai. | mixed | FW-CURIOSITY, FW-AI |
| HK-CURIOSITY-020 | Subah uth ke pehla kaam jo top brokers karte hain — ye hai. | hi-dominant | FW-CURIOSITY, FW-AUTHORITY |
| HK-CURIOSITY-021 | Maine ek lead ko 11 baar follow-up kiya. 11th pe deal hui. | mixed | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-022 | Kya ho agar AI tumhare 100 cold leads ko aaj call kare? | mixed | FW-CURIOSITY, FW-AI |
| HK-CURIOSITY-023 | Iss ek dashboard ne meri Sunday wapas de di. | hi-dominant | FW-CURIOSITY, FW-BAB |
| HK-CURIOSITY-024 | Tumhara competitor raat ko kya karta hai? Ye dekh ke tum chaunk jaoge. | hi-dominant | FW-CURIOSITY, FW-AI |
| HK-CURIOSITY-025 | Ek choti si aadat ne mera close rate double kar diya. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-026 | Iss broker ke paas office nahi hai, par 50 deals/mahina hote hain. Kaise? | mixed | FW-CURIOSITY, FW-CASE |
| HK-CURIOSITY-027 | Tumhe nahi pata tumhare best leads kahan se aate hain — par data ko pata hai. | mixed | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-028 | Ek minute do, aur batao kya hi tumhara real conversion rate hai? | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-029 | Maine apni team ka micromanagement band kiya — aur output badh gaya. | mixed | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-030 | Ye trick free hai, par zyadatar brokers use nahi karte. | mixed | FW-CURIOSITY, FW-MISTAKE |
| HK-CURIOSITY-031 | Tumhari sabse badi deal kahaan chhupi hai? Main batata hoon. | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-032 | Iss ek change se mera office ka hisaab 10 minute mein clear ho jaata hai. | hi-dominant | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-033 | Kya tumne kabhi socha ek lead actually kitne ki hai? | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-034 | AI calling sach mein kaam karti hai? Maine test kiya — dekho. | mixed | FW-CURIOSITY, FW-AI |
| HK-CURIOSITY-035 | Iss reel ke baad tum apni diary phenk doge. | hi-dominant | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-036 | Maine 6 broker se pucha — sab ek hi galti karte hain. | hi-dominant | FW-CURIOSITY, FW-MISTAKE |
| HK-CURIOSITY-037 | Ye chhota sa setup tumhe roz 2 ghante deta hai. | hi-dominant | FW-CURIOSITY, FW-BAB |
| HK-CURIOSITY-038 | Tumhe lagta hai tum organized ho? Ek test karo. | hi-dominant | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-039 | Follow-up rate poora — bina diary, bina alarm. Ho sakta hai? | mixed | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-040 | Ek client jise tum bhool gaye the — system ne yaad dilaya, deal hui. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-041 | Sabse bada secret? Top brokers data se chalte hain, mood se nahi. | mixed | FW-CURIOSITY, FW-AUTHORITY |
| HK-CURIOSITY-042 | Maine apne junior ko ek tool diya — usne senior ko beat kar diya. | hi-dominant | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-043 | Tumhari pipeline ke andar ek surprise hai — dikhau? | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-044 | Iss ek number ko track karna shuru karo — sab badal jayega. | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-045 | Kya ho agar tumhe pata chale kaunsa agent paisa bana raha, kaun nahi? | hi-dominant | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-046 | Maine apni saari property ek app mein daali — ab client wait nahi karta. | hi-dominant | FW-CURIOSITY, FW-PROPERTY |
| HK-CURIOSITY-047 | Tumhara sabse purana lead abhi bhi alive ho sakta hai. Verify karo. | mixed | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-048 | Ek reminder kitni badi deal bacha sakta hai? Apni sabse badi pending deal socho. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-049 | Iss feature ka demo dekh ke log free trial le lete hain. | hi-dominant | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-050 | Maine ek hafte apni saari calls AI ko di. Result? | mixed | FW-CURIOSITY, FW-AI |
| HK-CURIOSITY-051 | Tumhe ye pata hai ki tumhari sabse profitable area kaunsi hai? | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-052 | Bina ad budget ke deals possible hain? Apne referral aur repeat clients gino. | mixed | FW-CURIOSITY, FW-CASE |
| HK-CURIOSITY-053 | Ek aadmi, 500 leads, 0 chaos — sach hai, dikhau kaise. | mixed | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-054 | Maine apni team ko ek dashboard diya — micromanagement khatam. | hi-dominant | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-055 | Tum jo roz karte ho, usme ek leak hai. Spot karo. | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-056 | Iss ek aadat ko 30 din karo — income khud badh jayegi. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-057 | Maine ek client ko 6 mahine baad call kiya — kyunki system ne kaha. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-058 | Tumhe nahi pata, par tumhara phone tumhara CRM ban sakta hai. | hi-dominant | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-059 | Sabse zyada deal kaun karta hai? Jiska follow-up game best hai. | mixed | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-060 | Iss ek screen se main poora office chalata hoon. | hi-dominant | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-061 | Tumne kabhi gina ki tum kitne calls bhool jaate ho? | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-062 | Ek lead ki asli keemat jaan ke tum laaparwahi band kar doge. | hi-dominant | FW-CURIOSITY, FW-LEAD-LEAKAGE |
| HK-CURIOSITY-063 | Maine apna khata digital kiya — partner ka bharosa wapas aa gaya. | hi-dominant | FW-CURIOSITY |
| HK-CURIOSITY-064 | Iss app ka ek hidden feature tumhari Sunday bacha sakta hai. | mixed | FW-CURIOSITY, FW-BAB |
| HK-CURIOSITY-065 | Tumhe lagega ye chhoti baat hai — par yahi organized brokers ko alag karta hai. | hi-dominant | FW-CURIOSITY, FW-AUTHORITY |
| HK-CURIOSITY-066 | Maine apne agents ka leaderboard banaya — competition shuru ho gaya. | hi-dominant | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-067 | Ye 15 second tumhari working style badal denge. | hi-dominant | FW-CURIOSITY, FW-DEMO |
| HK-CURIOSITY-068 | Tumhare paas leads ki kami nahi — system ki kami hai. Saabit karta hoon. | hi-dominant | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-069 | Iss reel ko save karo — agle hafte tumhe iski zaroorat padegi. | hi-dominant | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-070 | Maine apni biggest deal kaise close ki? Ek follow-up note se. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-071 | Kya tumhara CRM tumhare liye call kar sakta hai? Mera karta hai. | mixed | FW-CURIOSITY, FW-AI |
| HK-CURIOSITY-072 | Tumhari diary kabhi nahi batayegi ki kaun sa lead ready hai. App batati hai. | hi-dominant | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-073 | Maine apne dimaag ko CRM banaya — galti thi. Ab samjha. | hi-dominant | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-074 | Ek sawaal jo har agency owner ko khud se puchna chahiye: is hafte kitne leads bina jawab ke reh gaye? | hi-dominant | FW-CURIOSITY, FW-FOUNDER |
| HK-CURIOSITY-075 | Tumhe pata hai tumhari team ka real follow-up rate kya hai? Mujhe dar lagta tha. | hi-dominant | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-076 | Iss tarah se property share karoge toh client haan bol dega. | hi-dominant | FW-CURIOSITY, FW-PROPERTY |
| HK-CURIOSITY-077 | Maine 1 hafta bina diary chalaya — wapas nahi gaya. | hi-dominant | FW-CURIOSITY, FW-BAB |
| HK-CURIOSITY-078 | Ye ek report owner ko dikhao — woh tumhe kabhi nahi chhodega. | hi-dominant | FW-CURIOSITY, FW-TEAM |
| HK-CURIOSITY-079 | Tumhare leads cold isliye hue kyunki tum slow the. Proof andar. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-080 | Sabse aasaan deal woh hai jise tum already bhool chuke the. | hi-dominant | FW-CURIOSITY, FW-FOLLOWUP |
| HK-CURIOSITY-081 | Ek setting jo tumhari conversion badal sakti hai — kisi ne batayi nahi. | mixed | FW-CURIOSITY, FW-CRM |
| HK-CURIOSITY-082 | Top broker ka ek secret jo office mein nahi, system mein chhupa hai. | hi-dominant | FW-CURIOSITY, FW-AUTHORITY |
| HK-CURIOSITY-083 | Maine ek cheez band ki aur deals badh gayi — kya thi woh? | hi-dominant | FW-CURIOSITY, FW-BAB |

## REVENUE (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-REVENUE-001 | 100 leads se 5 deal aur 100 leads se 15 deal — fark sirf system ka hai. | mixed | FW-LEAD-LEAKAGE |
| HK-REVENUE-002 | Ek miss follow-up = ek lakh ka nuksaan. Roz kitna chhod rahe ho? | mixed | FW-LEAD-LEAKAGE, FW-FEAR |
| HK-REVENUE-003 | Tumhari income leads pe nahi, follow-up pe depend karti hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-004 | Same leads, double income — sirf tracking badli. | mixed | FW-BAB, FW-LEAD-LEAKAGE |
| HK-REVENUE-005 | {{entry_price}} ka CRM, aur ek chhooti hui deal. Math khud karo. | mixed | FW-OBJECTION, FW-LEAD-LEAKAGE |
| HK-REVENUE-006 | Tum ads pe kharch karte ho, par leads waste kar dete ho. Apna ad spend nikaalo. | mixed | FW-LEAD-LEAKAGE, FW-FEAR |
| HK-REVENUE-007 | Conversion thoda upar jaye toh income kitna upar jayega? Apne numbers daalo. | mixed | FW-LEAD-LEAKAGE, FW-CASE |
| HK-REVENUE-008 | Har thanda lead jo dobara garam hua — extra commission hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-009 | Tumhe naye leads nahi chahiye — purane leads ka follow-up chahiye. | hi-dominant | FW-CONTRARIAN, FW-FOLLOWUP |
| HK-REVENUE-010 | Bina extra ad spend ke zyada kamaana — kaise? Pehle apne dead leads gino. | mixed | FW-CASE, FW-LEAD-LEAKAGE |
| HK-REVENUE-011 | Tumhare paas paisa table pe pada hai — woh hai ignored leads. | mixed | FW-LEAD-LEAKAGE |
| HK-REVENUE-012 | Mahine ka ek bada deal extra — bas yahi system ka ROI hai. | hi-dominant | FW-OBJECTION, FW-LEAD-LEAKAGE |
| HK-REVENUE-013 | Commission leak roz hota hai — manual hisaab mein chhupa hota hai. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-REVENUE-014 | Income badhani hai? Pehle leakage band karo, fir ad chalao. | hi-dominant | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-REVENUE-015 | Jis din tum har lead track karne lago, tumhari income jump karegi. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-016 | CRM kharcha nahi, ek silent salesman hai. | hi-dominant | FW-OBJECTION, FW-LEAD-LEAKAGE |
| HK-REVENUE-017 | Tumhari sabse badi growth opportunity tumhare 'lost' leads mein hai. | mixed | FW-LEAD-LEAKAGE |
| HK-REVENUE-018 | Ek extra deal = saal bhar ka CRM free. Soch lo. | hi-dominant | FW-OBJECTION, FW-LEAD-LEAKAGE |
| HK-REVENUE-019 | Tum 12 ghante kaam karte ho, kamaate kam — kyunki leak ho raha hai. | hi-dominant | FW-LEAD-LEAKAGE, FW-FEAR |
| HK-REVENUE-020 | Revenue badhane ke liye naya lead source chahiye, ya tight process? Pehle process naapo. | mixed | FW-CASE, FW-LEAD-LEAKAGE |
| HK-REVENUE-021 | Naye lead pe kharcha, purane lead pe zero — par dono mein deal chhupi hai. | mixed | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-REVENUE-022 | Tumhe lagta hai market slow hai — actually tumhara follow-up slow hai. | mixed | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-REVENUE-023 | Ek deal jo follow-up se bachi — woh CRM ka 1 saal cover karti hai. | hi-dominant | FW-OBJECTION, FW-LEAD-LEAKAGE |
| HK-REVENUE-024 | Revenue ka raaz: jo lead aaye, woh band na ho. Bas. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-025 | Tumhari pipeline ki value calculate ki? Shayad tum amir ho aur pata nahi. | mixed | FW-LEAD-LEAKAGE |
| HK-REVENUE-026 | Agent ko commission clearly do, woh double mehnat karega — income tumhari. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-REVENUE-027 | Tumhari dead lead list mein kitna paisa pada hai? Pehle count karo. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-REVENUE-028 | Income tab badhti hai jab har lead ka ek next step ho. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-029 | Tumhare best season ke leads abhi bhi paisa de sakte hain — agar zinda hain. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-030 | Brokers jo system use karte hain, unka follow-up chhootta nahi. Tumhara? | mixed | FW-AUTHORITY, FW-LEAD-LEAKAGE |
| HK-REVENUE-031 | {{entry_price}} ka tool, aur ek chhooti hui deal — return khud calculate karo. | mixed | FW-OBJECTION, FW-LEAD-LEAKAGE |
| HK-REVENUE-032 | Tumhari kamaai ka leak point follow-up hai, market nahi. | hi-dominant | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-REVENUE-033 | Math simple hai: kam leakage = zyada income. Apna leakage naapo. | mixed | FW-LEAD-LEAKAGE |
| HK-REVENUE-034 | Khata digital karo, phir dekho kitna commission abhi tak disputed pada hai. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-035 | Tumhare paas 3 saal ka data hai — usme crores ki dead deals hain. | mixed | FW-LEAD-LEAKAGE |
| HK-REVENUE-036 | Revenue double karna hai? Naye leads se pehle purane utilize karo. | hi-dominant | FW-CONTRARIAN, FW-FOLLOWUP |
| HK-REVENUE-037 | Har site visit ke baad follow-up = visit ki ROI double. | mixed | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-038 | Tumhari team ka har miss follow-up tumhari jeb se nikalta hai. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-REVENUE-039 | Organized broker aur unorganized broker — farq mahine ke end mein dikhta hai. | mixed | FW-AUTHORITY, FW-LEAD-LEAKAGE |
| HK-REVENUE-040 | Tum lead ko 'spend' samajhte ho — woh 'asset' hai. | mixed | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-REVENUE-041 | Mahine ke ant mein income kam? Beech mein follow-up leak tha. | hi-dominant | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-REVENUE-042 | Tumhare cold leads warm ho sakte hain — AI ko bolo. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-REVENUE-043 | Profit chhupa hota hai un calls mein jo tum nahi karte. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-044 | Tumhe ad budget nahi, follow-up discipline chahiye. | hi-dominant | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-REVENUE-045 | Ek lead ki cost nikalo, fir dekho kitne tum bin baat phenk rahe ho. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-046 | Same effort, better system, double commission. Yahi formula hai. | mixed | FW-BAB, FW-LEAD-LEAKAGE |
| HK-REVENUE-047 | Tumhari income ka ceiling tumhari memory hai. Memory hatao. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-REVENUE-048 | Khata clear hua toh partner khush, partner khush toh business double. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-049 | Roz 2 deal slip hoti hain — mahine ka 60. Calculate karo loss. | hi-dominant | FW-LEAD-LEAKAGE, FW-FEAR |
| HK-REVENUE-050 | Tum jo ad pe lagate ho, uska adha leakage mein jaata hai. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-051 | Revenue jump tab hua jab humne 'jo aaya usko close karo' rule banaya. | hi-dominant | FW-CASE, FW-LEAD-LEAKAGE |
| HK-REVENUE-052 | AI se 1 ghante mein 50 calls — usme se ek deal bhi profit hai. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-REVENUE-053 | Tumhara sabse mehnga lead woh hai jo tum follow-up nahi karte. | mixed | FW-LEAD-LEAKAGE, FW-FEAR |
| HK-REVENUE-054 | Income ka shortcut nahi hai — par leak band karna shortcut jaisa lagta hai. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-055 | CRM se paisa double? Aisa koi vaada nahi. Pehle apna leakage naapo. | mixed | FW-CASE, FW-LEAD-LEAKAGE |
| HK-REVENUE-056 | Tumhari pipeline ko paise mein convert karna seekho. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-057 | Jab follow-up automatic ho, income predictable ho jaati hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-058 | Tumhe 100 naye leads se zyada, 100 purane leads ka follow-up chahiye. | hi-dominant | FW-CONTRARIAN, FW-FOLLOWUP |
| HK-REVENUE-059 | Commission dispute mein paisa nahi, rishte bhi jaate hain. | hi-dominant | FW-FEAR, FW-LEAD-LEAKAGE |
| HK-REVENUE-060 | Tumhari kamaai uss agent pe atki hai jo follow-up bhool jaata hai. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-REVENUE-061 | Ek system, teen guni deals — ye exaggeration nahi, math hai. | mixed | FW-BAB, FW-LEAD-LEAKAGE |
| HK-REVENUE-062 | Lead leakage tumhari sabse badi 'invisible' expense hai. | mixed | FW-LEAD-LEAKAGE |
| HK-REVENUE-063 | Tumhe pata bhi nahi tum amir broker ban sakte the — bas leak band karna tha. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-064 | Profit wahan hai jahan tumhari nazar nahi jaati — pipeline ke peeche. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-065 | CRM ka kharcha mahine ka, return saalon ka. | hi-dominant | FW-OBJECTION, FW-LEAD-LEAKAGE |
| HK-REVENUE-066 | Aaj ke 5 follow-up = agle mahine ki 1 deal. Compound karo. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-067 | Tum sirf isliye gareeb broker ho kyunki tum disorganized broker ho. | hi-dominant | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-REVENUE-068 | Dead lead ek myth hai — sirf ignored lead hota hai. | mixed | FW-MYTH, FW-FOLLOWUP |
| HK-REVENUE-069 | Ek deal extra per mahina — yahi to wealth banata hai. | hi-dominant | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-REVENUE-070 | Tumhari mehnat sahi hai, system galat hai — isliye paisa nahi tikta. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-REVENUE-071 | Jo broker numbers dekhta hai, woh numbers banata bhi hai. | mixed | FW-AUTHORITY, FW-LEAD-LEAKAGE |
| HK-REVENUE-072 | Tumhe scaling se pehle 'plugging' chahiye — leak plug karo. | mixed | FW-LEAD-LEAKAGE, FW-CONTRARIAN |
| HK-REVENUE-073 | Lead lane ka kharcha hai, follow-up ka zero — phir bhi tum follow-up nahi karte. | hi-dominant | FW-FOLLOWUP, FW-FEAR |
| HK-REVENUE-074 | Income ka sabse bada lever: speed-to-lead. Tum kitne minute mein call karte ho? | mixed | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-075 | Tumhari diary mein crores dabe hain — sirf khud ko unlock karo. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-076 | Profit margin tumhare process ki cleanliness pe depend karta hai. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-REVENUE-077 | Tum jise 'slow month' bolte ho, woh 'poor follow-up month' hota hai. | mixed | FW-CONTRARIAN, FW-FOLLOWUP |
| HK-REVENUE-078 | Ek hi lead se 3 deal nikal sakti hain — agar relationship rakho. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-079 | Tumhe rich banne ke liye genius nahi, consistent follow-up chahiye. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REVENUE-080 | Saal ke ant mein hisaab karo — leakage hi tumhari biggest expense thi. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-REVENUE-081 | Ek extra deal per mahina = ek saal mein ek nayi gaadi. | hi-dominant | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-REVENUE-082 | Tumhari kamaai follow-up ki consistency ke barabar hai. | mixed | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-REVENUE-083 | Leak band karna naye leads laane se sasta hai. | mixed | FW-LEAD-LEAKAGE |

## SALES (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-SALES-001 | Deal close nahi hoti talent se — follow-up se hoti hai. | hi-dominant | FW-FOLLOWUP, FW-CONVO |
| HK-SALES-002 | Client 'sochta hoon' bole toh deal khatam nahi — game shuru hota hai. | hi-dominant | FW-OBJECTION, FW-CONVO |
| HK-SALES-003 | Jo broker pehle call karta hai, deal usi ki hoti hai. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-004 | 'Mahanga hai' bolne wala client actually 'samjha nahi' bol raha hai. | hi-dominant | FW-OBJECTION, FW-CONVO |
| HK-SALES-005 | Top closer aur average broker mein ek hi fark hai: consistency. | mixed | FW-AUTHORITY, FW-FOLLOWUP |
| HK-SALES-006 | Client ko 5 min mein call karo — warna woh kisi aur ka ho jayega. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-007 | Sale tab hoti hai jab tum 7th time follow-up karte ho, 1st nahi. | mixed | FW-FOLLOWUP |
| HK-SALES-008 | Closing ek event nahi — process hai. Process system se chalta hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-009 | Tum deal lose nahi karte — tum follow-up lose karte ho. | hi-dominant | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-SALES-010 | Client ka 'NO' actually 'abhi nahi' hota hai — track karo. | hi-dominant | FW-OBJECTION, FW-FOLLOWUP |
| HK-SALES-011 | Jo client call pe history yaad rakhe, woh deal jeet leta hai. | hi-dominant | FW-FOLLOWUP, FW-PROPERTY |
| HK-SALES-012 | Pitch nahi, timing deal karwati hai. Timing system deta hai. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-013 | Sabse achha salesman? Woh jo kabhi follow-up nahi bhoolta. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-014 | Client confused hai toh deal stuck hai — usko clarity do, history se. | hi-dominant | FW-OBJECTION, FW-PROPERTY |
| HK-SALES-015 | Deal todi nahi jaati — woh dheere dheere chhoot jaati hai. | hi-dominant | FW-FOLLOWUP, FW-FEAR |
| HK-SALES-016 | Smart broker pitch kam, suntaa zyada hai — aur sab note karta hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-017 | Har 'main wapas call karunga' ek promise hai — usse mat todo. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-018 | Closing rate badhana hai? Speed-to-lead pe kaam karo. | mixed | FW-FOLLOWUP |
| HK-SALES-019 | Client ko lagta hai tum bhool gaye — wahi pe deal marti hai. | hi-dominant | FW-FOLLOWUP, FW-FEAR |
| HK-SALES-020 | Sale ka zyada hissa pehli meeting ke baad hota hai — follow-up mein. | mixed | FW-FOLLOWUP |
| HK-SALES-021 | Objection ko fight mat karo — uska data rakho aur baad mein wapas aao. | hi-dominant | FW-OBJECTION, FW-FOLLOWUP |
| HK-SALES-022 | Jo broker tezi se respond karta hai, usko 'lucky' bolte hain. Lucky nahi, fast hai. | mixed | FW-CONTRARIAN, FW-FOLLOWUP |
| HK-SALES-023 | Pehla follow-up sabse aasaan hai — log 6th pe haar jaate hain. | mixed | FW-FOLLOWUP |
| HK-SALES-024 | Client ka budget, family, urgency — sab yaad rakho, ya app ko bolo. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-SALES-025 | Closing ki sabse badi galti: deal ko 'apne aap' chhod dena. | hi-dominant | FW-FOLLOWUP, FW-MISTAKE |
| HK-SALES-026 | Tumhari pitch perfect hai, par follow-up zero — isliye sale zero. | hi-dominant | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-SALES-027 | Achha salesman lead nahi maangta — purane leads ko revive karta hai. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-028 | Client ko trust tab aata hai jab tum uski har baat yaad rakho. | hi-dominant | FW-FOLLOWUP, FW-PROPERTY |
| HK-SALES-029 | Deal lose hone ka 1 reason: tum baad mein bhool gaye. | hi-dominant | FW-FOLLOWUP, FW-FEAR |
| HK-SALES-030 | Sale ek marathon hai, sprint nahi — system stamina deta hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-031 | Jab client confuse ho, structured info bhejo — deal khul jaati hai. | hi-dominant | FW-OBJECTION, FW-PROPERTY |
| HK-SALES-032 | Tum deal beech mein chhod dete ho — closers ant tak rehte hain. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-033 | Sabse mehnga client woh hai jise tum follow-up nahi karte. | mixed | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-SALES-034 | Deal ka temperature track karo — hot, warm, cold. Phir attack karo. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-035 | Closing ka asli hero: reminder jo time pe baja. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-036 | Client ko impress karna hai? Uski purani baat yaad dilao. | hi-dominant | FW-FOLLOWUP, FW-PROPERTY |
| HK-SALES-037 | Sale tab tak nahi hoti jab tak tum 'next step' set na karo. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-038 | Tum talented ho, organized nahi — isliye deal slip hoti hai. | hi-dominant | FW-CRM, FW-CONTRARIAN |
| HK-SALES-039 | Pune ka top broker pitch nahi, process se jeetta hai. | mixed | FW-AUTHORITY, FW-FOLLOWUP |
| HK-SALES-040 | Har deal ke peeche ek discipline hai jo dikhti nahi. | hi-dominant | FW-FOLLOWUP, FW-AUTHORITY |
| HK-SALES-041 | Client ne dusre se liya kyunki woh 'available' tha, tum nahi. | hi-dominant | FW-FOLLOWUP, FW-FEAR |
| HK-SALES-042 | Deal close karna seekhna hai? Pehle follow-up close karna seekho. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-043 | Tumhari sale ki speed tumhari note-taking ki speed jitni hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-044 | Client ka objection mat ignore karo — usko CRM mein note karke wapas attack karo. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-SALES-045 | Top broker zyada leads nahi chahta — poora follow-up chahta hai. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-046 | Sale ka secret formula: yaad rakhna + time pe pahunchna. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-047 | Jo broker har lead ko 'serious' treat kare, woh hi serious paisa kamaata hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-SALES-048 | Client ki shaadi, kids, EMI — sab note rakho, deal personal ban jaati hai. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-SALES-049 | Tum closing nahi seekh rahe — tum bhoolna band karo, sab theek ho jayega. | hi-dominant | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-SALES-050 | Sale ko 'event' samajhna band karo — woh follow-up ka result hai. | mixed | FW-FOLLOWUP |
| HK-SALES-051 | Client ko 3 din mein bhool jaate ho? Deal bhi 3 din mein bhool jayegi tumhe. | hi-dominant | FW-FOLLOWUP, FW-FEAR |
| HK-SALES-052 | Achhi sale ke peeche 8 follow-up hote hain. Tum 2 pe haar jaate ho. | mixed | FW-FOLLOWUP |
| HK-SALES-053 | Client ka trust = consistency. Consistency = system. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-054 | Deal stuck hai? Shayad tumne next call set nahi kiya. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-055 | Sale ka sabse bada killer: 'main yaad rakhunga'. | hi-dominant | FW-FOLLOWUP, FW-MISTAKE |
| HK-SALES-056 | Tum better closer nahi, better follow-upper banoge toh deals badhengi. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-057 | Har deal ek timeline mangti hai — bina timeline deal random hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-058 | Closer woh hai jo client se zyada uski deal ko yaad rakhe. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-059 | Sale ka science: right lead, right time, right message. | mixed | FW-FOLLOWUP, FW-AI |
| HK-SALES-060 | Tum sirf isliye haar rahe ho kyunki tum 'baad mein' bolte ho. | hi-dominant | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-SALES-061 | Client jab ready hota hai, tum kahan hote ho? Reminder ke paas raho. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-062 | Deal jeetne wale broker note lete hain, baaki maafi maangte hain. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-SALES-063 | Sale tab hoti hai jab system tumhe sahi din pe call karwaye. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-064 | Tum jise 'tough client' bolte ho, woh sirf 'slow follow-up client' hai. | mixed | FW-OBJECTION, FW-FOLLOWUP |
| HK-SALES-065 | Closing rate boost karne ka cheapest tarika: time pe wapas call karo. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-066 | Client ka har sawaal ek buying signal hai — note karo. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-SALES-067 | Sale ek relationship hai, transaction nahi — relationships yaadon se chalti hain. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-SALES-068 | Tumhari deal isliye nahi hui kyunki competitor 5 minute tez tha. | hi-dominant | FW-FOLLOWUP, FW-FEAR |
| HK-SALES-069 | Closing ka ustad woh hai jiske paas ek bhi lead 'forgotten' nahi. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-070 | Sale slow hai? Apna follow-up gap naapo, pitch nahi. | hi-dominant | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-SALES-071 | Client ki history yaad ho toh objection handle aasaan ho jaata hai. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-SALES-072 | Tum deals chhodte ho 'shayad woh interested nahi' soch ke. Galat. | hi-dominant | FW-FOLLOWUP, FW-MISTAKE |
| HK-SALES-073 | Sale = persistence + memory. Dono system de sakta hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-SALES-074 | Tum jis client ko 'time waste' samjhe, woh 6 mahine baad buyer nikla. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-SALES-075 | Top broker ka raaz: koi lead bina next step ke nahi chhodta. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-076 | Deal band karne ke liye loud mat bano — punctual bano. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-077 | Tum jitna organized, utna confident — confidence sale karta hai. | hi-dominant | FW-CRM, FW-FOLLOWUP |
| HK-SALES-078 | Client ko impress nahi, follow-up se trust jeeto. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-079 | Sale ka real MVP woh broker hai jiski memory machine pe hai. | hi-dominant | FW-CRM, FW-FOLLOWUP |
| HK-SALES-080 | Jeetne wale deal pakadte hain, haarne wale 'busy' the. | hi-dominant | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-SALES-081 | 'Sochta hoon' ka matlab 'follow-up karo' hota hai, 'chhod do' nahi. | hi-dominant | FW-FOLLOWUP |
| HK-SALES-082 | Deal objection pe nahi, silence pe marti hai — follow-up karo. | mixed | FW-FOLLOWUP |
| HK-SALES-083 | Closing ek event nahi, follow-ups ki chain ka result hai. | mixed | FW-FOLLOWUP |

## LEAD-MANAGEMENT (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-LEAD-MANAGEMENT-001 | 100 leads aaye — kitne ka pata hai abhi kahan hain? | hi-dominant | FW-LEAD-LEAKAGE, FW-MISTAKE |
| HK-LEAD-MANAGEMENT-002 | Lead aata kahin se, jaata kahin — tumhe pata hi nahi. | hi-dominant | FW-LEAD-LEAKAGE, FW-CRM |
| HK-LEAD-MANAGEMENT-003 | WhatsApp, calls, portal — leads 4 jagah, control kahin nahi. | mixed | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-004 | Har lead ka ek owner hona chahiye — varna sab ka, koi ka nahi. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-005 | Lead status pata hai? 'New', 'hot', 'dead' — ya sab 'pata nahi'? | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-006 | Naye leads ke chakkar mein purane bhool jaate ho — wahi loss hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-007 | Ek lead ko 2 agent call karte hain — client confuse, deal gayi. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-008 | Lead aaya, kisne pakda? Agar jawab nahi, leak ho gaya. | hi-dominant | FW-LEAD-LEAKAGE, FW-TEAM |
| HK-LEAD-MANAGEMENT-009 | Tum leads collect karte ho, manage nahi — wahi galti hai. | hi-dominant | FW-CRM, FW-MISTAKE |
| HK-LEAD-MANAGEMENT-010 | Lead ka source pata nahi toh ad budget andhere mein ja raha hai. | mixed | FW-LEAD-LEAKAGE, FW-CRM |
| HK-LEAD-MANAGEMENT-011 | Hot lead 24 ghante mein cold ho jaata hai — tumne kab call kiya? | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-012 | Tumhare paas lead ki kami nahi, follow-up system ki kami hai. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-013 | Lead assign karo, owner banao, accountability lao — varna chaos. | hi-dominant | FW-TEAM, FW-CRM |
| HK-LEAD-MANAGEMENT-014 | Kitne leads ek call ke baad gayab ho jaate hain? Aaj gino. | mixed | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-LEAD-MANAGEMENT-015 | Lead ka next step set nahi? Toh woh lead nahi, ek note hai. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-LEAD-MANAGEMENT-016 | Lead ki history bina, har call zero se shuru hota hai. | hi-dominant | FW-CRM, FW-PROPERTY |
| HK-LEAD-MANAGEMENT-017 | Tumhe nahi pata kaunsa channel best leads de raha hai — guess kar rahe ho. | mixed | FW-LEAD-LEAKAGE, FW-CRM |
| HK-LEAD-MANAGEMENT-018 | Lead pile up ho rahe hain, par follow-up nil — wahi backlog katil hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-019 | Ek jagah saare leads — yahi pehla step hai sanity ka. | hi-dominant | FW-CRM, FW-WHATSAPP-CHAOS |
| HK-LEAD-MANAGEMENT-020 | Lead management ka matlab Excel nahi — Excel toh sirf storage hai. | mixed | FW-CRM, FW-MYTH |
| HK-LEAD-MANAGEMENT-021 | Tumhari pipeline mein kitne 'dead' leads sach mein dead hain? Tum jaldbaaz the. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-022 | Jab tak har lead trackable nahi, tab tak business gamble hai. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-023 | Lead aate hi turant respond karo — der lagi toh woh kisi aur ka ho gaya. | mixed | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-024 | Tum lead ko forget karte ho, competitor usko nurture karta hai. | hi-dominant | FW-LEAD-LEAKAGE, FW-FEAR |
| HK-LEAD-MANAGEMENT-025 | Lead score karo — sab equal nahi hote. Effort smartly lagao. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-026 | Tumhe pata hona chahiye: aaj kitne naye, kitne pending, kitne hot. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-027 | Lead ko 'baad mein dekhenge' folder mein daala? Woh dafan ho gaya. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-028 | Har lost lead ek lesson nahi — ek system gap hai. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-029 | Lead ki age dekho — 7 din purana lead aksar zinda hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-LEAD-MANAGEMENT-030 | Tumhe naye lead nahi chahiye — purane ka proper management chahiye. | hi-dominant | FW-CONTRARIAN, FW-FOLLOWUP |
| HK-LEAD-MANAGEMENT-031 | Lead ka journey track karo: enquiry → call → visit → deal. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-032 | Jis din tum lead source track karoge, ad spend half kar doge. | mixed | FW-LEAD-LEAKAGE, FW-CRM |
| HK-LEAD-MANAGEMENT-033 | Lead ko phone ki diary mein rakhna — sabse khatarnaak storage hai. | hi-dominant | FW-CRM, FW-FEAR |
| HK-LEAD-MANAGEMENT-034 | Tumhare paas leads ka dher hai, par koi system nahi — dher bekaar hai. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-035 | Lead distribute karo fairly — varna ek agent overloaded, baaki khaali. | hi-dominant | FW-TEAM, FW-CRM |
| HK-LEAD-MANAGEMENT-036 | Har lead par ek timestamp — kab aaya, kab call hua, kab visit. | mixed | FW-CRM, FW-FOLLOWUP |
| HK-LEAD-MANAGEMENT-037 | Lead 'gum' nahi hota — tum use track karna bhool jaate ho. | hi-dominant | FW-LEAD-LEAKAGE, FW-CRM |
| HK-LEAD-MANAGEMENT-038 | Tumhare best leads notification ke neeche dab gaye hain. | mixed | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-039 | Lead pakdo turant, nurture dheere — par chhodo kabhi nahi. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-040 | Tum lead ko ignore karte ho jab tak woh 'bug' na kare. Galat strategy. | hi-dominant | FW-FOLLOWUP, FW-MISTAKE |
| HK-LEAD-MANAGEMENT-041 | Ek dashboard pe saare leads — chaos se control tak ek screen. | hi-dominant | FW-CRM, FW-DEMO |
| HK-LEAD-MANAGEMENT-042 | Lead conversion rate pata nahi? Toh tum blind chal rahe ho. | mixed | FW-LEAD-LEAKAGE, FW-CRM |
| HK-LEAD-MANAGEMENT-043 | Tumhare leads multiple sheets mein hain — yahi pe leak shuru hota hai. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-044 | Lead ki priority set karo — sab ko same time mat do. | hi-dominant | FW-CRM, FW-FOLLOWUP |
| HK-LEAD-MANAGEMENT-045 | Naya lead aaya — kya pehle wale 50 follow-up ho chuke? | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-046 | Lead ka data ek jagah ho toh handover aasaan hota hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-LEAD-MANAGEMENT-047 | Tum lead ko 'lost' tab bolte ho jab tumne 2 call kiye, 8 nahi. | mixed | FW-FOLLOWUP, FW-MISTAKE |
| HK-LEAD-MANAGEMENT-048 | Lead management = har lead ka clear status + next action. | mixed | FW-CRM, FW-FOLLOWUP |
| HK-LEAD-MANAGEMENT-049 | Tumhare agent leads 'apne' bolte hain — par data agency ka hona chahiye. | hi-dominant | FW-TEAM, FW-CRM |
| HK-LEAD-MANAGEMENT-050 | Lead aaye toh celebrate mat karo — convert karo, fir celebrate. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-051 | Tum lead ki quantity dekhte ho, management quality maangti hai. | mixed | FW-CONTRARIAN, FW-CRM |
| HK-LEAD-MANAGEMENT-052 | Lead leakage ek dard nahi — ek silent disease hai. | mixed | FW-LEAD-LEAKAGE, FW-FEAR |
| HK-LEAD-MANAGEMENT-053 | Har lead ke saath ek note: kya chahta hai, kab chahta hai. | hi-dominant | FW-CRM, FW-PROPERTY |
| HK-LEAD-MANAGEMENT-054 | Lead ko system mein daala = lead ko bachaya. Simple. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-055 | Tumhare paas 3 mahine purana lead hai jo abhi buy karne wala hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-056 | Lead distribution random hai? Toh fairness aur deals dono random. | hi-dominant | FW-TEAM, FW-CRM |
| HK-LEAD-MANAGEMENT-057 | Lead pe pehla response time tumhari conversion ka king hai. | mixed | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-058 | Tum leads ginti ho, manage nahi karte — isliye numbers jhooth bolte hain. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-059 | Lead ka follow-up calendar mein nahi? Toh woh hoga hi nahi. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-LEAD-MANAGEMENT-060 | Ek lead ka 360 view — naam, requirement, budget, history — ek click. | mixed | FW-CRM, FW-DEMO |
| HK-LEAD-MANAGEMENT-061 | Tumhe lagta hai tum sab leads handle kar rahe ho — count karke dekho. | hi-dominant | FW-LEAD-LEAKAGE, FW-MISTAKE |
| HK-LEAD-MANAGEMENT-062 | Lead ko nurture karo jaise plant — paani (follow-up) chahiye regularly. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-LEAD-MANAGEMENT-063 | Tumhare leads ka graveyard tumhari WhatsApp hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-064 | Lead management seekho — ya leads dekhte raho gayab hote. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-065 | Tum jise 'spam lead' bolte ho, woh shayad real buyer tha — verify kiya? | hi-dominant | FW-LEAD-LEAKAGE, FW-MISTAKE |
| HK-LEAD-MANAGEMENT-066 | Lead pipeline saaf rakho — clutter mein deal chhup jaati hai. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-067 | Har enquiry ek lead hai — usko enquiry hi mat rehne do. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-068 | Lead ka status update karo daily — varna pipeline jhooth bolega. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-069 | Tum lead ko time nahi dete, fir bolte ho 'leads achhe nahi'. | hi-dominant | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-070 | Lead nurturing ek skill hai — system usko aadat bana deta hai. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-LEAD-MANAGEMENT-071 | Lead aaya raat ko, tumne dekha subah — game over. | hi-dominant | FW-FOLLOWUP, FW-AI |
| HK-LEAD-MANAGEMENT-072 | Tumhe har lead ki age pata honi chahiye — purana lead = urgent lead. | mixed | FW-FOLLOWUP, FW-CRM |
| HK-LEAD-MANAGEMENT-073 | Lead ka ek number ek deal hai — usko phone diary mein dafan mat karo. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-074 | Sahi lead management se tum same leads se double deal nikaloge. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-075 | Lead 'busy' mat bolo — disorganized bolo, woh sach hai. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-LEAD-MANAGEMENT-076 | Tum leads ka backup rakhte ho? Ya sab phone ki kismat pe? | hi-dominant | FW-FEAR, FW-CRM |
| HK-LEAD-MANAGEMENT-077 | Lead source + lead status + lead owner — teen cheez clear, sab clear. | mixed | FW-CRM, FW-TEAM |
| HK-LEAD-MANAGEMENT-078 | Har lead pe action lo ya use release karo — limbo sabse bura hai. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-079 | Tumhe lead chahiye ya tumhe deal chahiye? Donon mein system ka fark hai. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-080 | Lead ko track karo jaise paisa — kyunki woh paisa hi hai. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-LEAD-MANAGEMENT-081 | Har lead ka ek next step ho — warna har lead ek dead end. | mixed | FW-LEAD-LEAKAGE, FW-CRM |
| HK-LEAD-MANAGEMENT-082 | Lead capture se follow-up tak — ek bhi gap, ek lost deal. | mixed | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-LEAD-MANAGEMENT-083 | Tum naye leads kharidte ho, purane leads ko marne dete ho. | hi-dominant | FW-LEAD-LEAKAGE |

## CRM (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-CRM-001 | CRM matlab Excel nahi, bhai. 2026 aa gaya. | hi-dominant | FW-CRM, FW-MYTH |
| HK-CRM-002 | Tumhara dimaag CRM nahi hai — aur dimaag dhokha deta hai. | mixed | FW-CRM, FW-FEAR |
| HK-CRM-003 | CRM mahanga nahi hai — leads kho dena mahanga hai. | mixed | FW-OBJECTION, FW-CRM |
| HK-CRM-004 | CRM sirf badi company ke liye? Ye sabse bada myth hai. | hi-dominant | FW-MYTH, FW-CRM |
| HK-CRM-005 | Spreadsheet chhodo, system pakdo — yahi ek decision sab badalta hai. | hi-dominant | FW-CRM, FW-BAB |
| HK-CRM-006 | Real estate CRM woh hai jo property, lead, khata — sab samjhe. | hi-dominant | FW-CRM, FW-AUTHORITY |
| HK-CRM-007 | Tumhe CRM seekhne ki zaroorat nahi — bas WhatsApp se aage badho. | hi-dominant | FW-CRM, FW-OBJECTION |
| HK-CRM-008 | CRM koi extra kaam nahi — woh tumhara kaam kam karta hai. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-CRM-009 | Excel mein 5 din lagte hain jo CRM 5 minute mein karta hai. | mixed | FW-CRM, FW-BAB |
| HK-CRM-010 | CRM ka matlab control hai — tum kya, kab, kaun, sab dekh sakte ho. | hi-dominant | FW-CRM, FW-TEAM |
| HK-CRM-011 | Tumhe lagta hai CRM time leta hai — actually woh time deta hai. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-CRM-012 | Mobile CRM matlab — office tumhari jeb mein, field mein bhi. | hi-dominant | FW-CRM, FW-PROPERTY |
| HK-CRM-013 | CRM tumhe yaad dilata hai woh sab jo tum bhool jaate ho. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-CRM-014 | Diary ke pages girte hain, CRM ka data nahi. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-015 | Tumhara CRM tumhare liye call bhi kar sakta hai — AI se. | mixed | FW-AI, FW-CRM |
| HK-CRM-016 | CRM ek tool nahi — woh tumhara silent business partner hai. | hi-dominant | FW-CRM, FW-AUTHORITY |
| HK-CRM-017 | Real CRM woh jo Hinglish samjhe, tumhara kaam samjhe. | hi-dominant | FW-CRM, FW-AUTHORITY |
| HK-CRM-018 | Tum CRM nahi le rahe? Tum apni growth ko rok rahe ho. | hi-dominant | FW-CRM, FW-CONTRARIAN |
| HK-CRM-019 | CRM matlab 'sab ek jagah' — leads, follow-up, property, team. | hi-dominant | FW-CRM, FW-DEMO |
| HK-CRM-020 | Tumhari memory full ho gayi — ab system ko kaam do. | hi-dominant | FW-CRM, FW-BAB |
| HK-CRM-021 | CRM se darte ho? Asal mein chaos se darna chahiye. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-022 | Ek broker bina CRM = ek doctor bina file. | mixed | FW-CRM, FW-MYTH |
| HK-CRM-023 | CRM tumhe organize nahi karta — woh tumhe rich banata hai. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-CRM-024 | Tumhe technical nahi hona — CRM ab WhatsApp jitna easy hai. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-CRM-025 | CRM ka pehla benefit: raat ko chain ki neend. | hi-dominant | FW-CRM, FW-BAB |
| HK-CRM-026 | Excel mein client call aate hi tum scroll karte raho — CRM mein 1 search. | mixed | FW-CRM, FW-PROPERTY |
| HK-CRM-027 | CRM owner ke liye nahi, sabse zyada agent ke liye useful hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-CRM-028 | Tumhara competitor CRM pe hai — isliye tezi se close karta hai. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-029 | CRM matlab har lead ka hisaab, har follow-up ka reminder. | hi-dominant | FW-CRM, FW-FOLLOWUP |
| HK-CRM-030 | Tum CRM ko cost samajhte ho — woh insurance hai tumhari deals ka. | mixed | FW-OBJECTION, FW-CRM |
| HK-CRM-031 | Phone-first CRM — kyunki tum office mein nahi, field mein hote ho. | hi-dominant | FW-CRM, FW-PROPERTY |
| HK-CRM-032 | CRM woh hai jo naya banda delete nahi kar sakta — control tumhara. | hi-dominant | FW-CRM, FW-TEAM |
| HK-CRM-033 | CRM lena complicated nahi — usko na lena complicated banata hai sab. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-CRM-034 | Tum manual kaam ko 'mehnat' bolte ho — woh actually waqt ki barbaadi hai. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-CRM-035 | CRM ke bina scaling — ek myth hai. Saabit karta hoon. | mixed | FW-MYTH, FW-CRM |
| HK-CRM-036 | Real estate ka CRM banking app jaisa hona chahiye — clear, fast, mobile. | mixed | FW-CRM, FW-AUTHORITY |
| HK-CRM-037 | CRM tumhe har client ki poori kahani 2 second mein deta hai. | hi-dominant | FW-CRM, FW-PROPERTY |
| HK-CRM-038 | Tum WhatsApp ko CRM samajh rahe ho — wahi tumhari sabse badi galti hai. | mixed | FW-WHATSAPP-CHAOS, FW-MYTH |
| HK-CRM-039 | CRM = tumhari diary + tumhari memory + tumhara assistant, ek mein. | hi-dominant | FW-CRM, FW-DEMO |
| HK-CRM-040 | Tumhe CRM nahi chahiye tha — jab tak ek bada lead miss nahi hua. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-041 | CRM ki keemat {{entry_price}}, ek lost deal ki keemat? Khud jodo. | mixed | FW-OBJECTION, FW-CRM |
| HK-CRM-042 | Tumhari team CRM 'nahi seekhegi'? Aaj ke agent app se hi paida hue hain. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-CRM-043 | CRM tumhara kaam organize nahi karta — woh tumhe time-traveller bana deta hai. | mixed | FW-CRM, FW-BAB |
| HK-CRM-044 | Tumhe CRM se nafrat hai? Tumne galat CRM use kiya hoga. | hi-dominant | FW-CRM, FW-MYTH |
| HK-CRM-045 | Ek achha CRM tumhe har subah batata hai aaj kya karna hai. | hi-dominant | FW-CRM, FW-DEMO |
| HK-CRM-046 | CRM ke bina, har naya agent zero se shuru karta hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-CRM-047 | Real CRM woh hai jo offline bhi chale, network slow ho tab bhi. | mixed | FW-CRM, FW-AUTHORITY |
| HK-CRM-048 | Tum data ko phone mein rakhte ho — CRM use cloud mein safe rakhta hai. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-049 | CRM matlab business ek aadmi pe nahi — system pe chale. | hi-dominant | FW-CRM, FW-TEAM |
| HK-CRM-050 | Tumhe CRM 'baad mein' chahiye? Baad mein tak competitor aage nikal jayega. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-051 | CRM = predictability. Predictability = peace + profit. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-CRM-052 | Tum CRM ko complex banate ho — sahi CRM khud simple hota hai. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-CRM-053 | Excel mein formula tootta hai — CRM mein kuch nahi tootta. | mixed | FW-CRM, FW-MYTH |
| HK-CRM-054 | CRM tumhe ye batata hai ki kaunsa lead ab paisa banayega. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-CRM-055 | Tumhe CRM se zyada apni puraani aadaton se ladna padega — woh hi asli kaam hai. | hi-dominant | FW-CRM, FW-CONTRARIAN |
| HK-CRM-056 | CRM koi luxury nahi — survival hai is competitive market mein. | mixed | FW-CRM, FW-FEAR |
| HK-CRM-057 | Real CRM tumhe owner reporting 1 click mein deta hai. | mixed | FW-CRM, FW-TEAM |
| HK-CRM-058 | Tum spreadsheet pe pride karte ho — woh actually tumhari ceiling hai. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-CRM-059 | CRM woh assistant hai jo na chhutti leta hai, na bhoolta hai. | hi-dominant | FW-CRM, FW-AI |
| HK-CRM-060 | Tumhe CRM tab samajh aayega jab pehli baar koi lead bach jayega. | hi-dominant | FW-CRM, FW-BAB |
| HK-CRM-061 | CRM ke bina business chalana — bina speedometer gaadi chalana hai. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-062 | Achha CRM tumhe kaam nahi sikhata — tumhara kaam yaad rakhta hai. | hi-dominant | FW-CRM, FW-FOLLOWUP |
| HK-CRM-063 | Tum CRM ko 'feature' samajhte ho — woh tumhari poori foundation hai. | mixed | FW-CRM, FW-AUTHORITY |
| HK-CRM-064 | CRM ka asli magic: har lead ko system kabhi bhoolta nahi. | hi-dominant | FW-CRM, FW-FOLLOWUP |
| HK-CRM-065 | Tumhare paas data hai — CRM usko paise mein badalta hai. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-CRM-066 | Real estate CRM jo aapka kaam samjhe — Hinglish mein, mobile pe. | hi-dominant | FW-CRM, FW-AUTHORITY |
| HK-CRM-067 | Tum free mein CRM try kar sakte ho — par chaos free nahi hai. | hi-dominant | FW-OBJECTION, FW-CRM |
| HK-CRM-068 | CRM tumhe micromanager nahi banata — woh tumhe free banata hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-CRM-069 | Tumhe CRM ki zaroorat nahi lagti — kyunki tumne kabhi count nahi kiya nuksaan. | hi-dominant | FW-CRM, FW-LEAD-LEAKAGE |
| HK-CRM-070 | Spreadsheet tumhe data deta hai, CRM tumhe decision deta hai. | mixed | FW-CRM, FW-AUTHORITY |
| HK-CRM-071 | CRM matlab business ka brain — bina brain ke kaam reflex hai. | hi-dominant | FW-CRM, FW-AUTHORITY |
| HK-CRM-072 | Tum CRM ko later ke liye rakhte ho — later mein tum bahut peeche ho. | hi-dominant | FW-CRM, FW-FEAR |
| HK-CRM-073 | CRM ek baar set karo, fir woh roz tumhare liye kaam karega. | hi-dominant | FW-CRM, FW-DEMO |
| HK-CRM-074 | Tumhari sabse badi competitor hai tumhari purani aadat — CRM usko todta hai. | hi-dominant | FW-CRM, FW-CONTRARIAN |
| HK-CRM-075 | CRM woh kaam karta hai jo tum 'baad mein' ke folder mein daal dete ho. | hi-dominant | FW-CRM, FW-FOLLOWUP |
| HK-CRM-076 | Tum CRM nahi, ek system khareed rahe ho jo tumhare bina bhi chale. | hi-dominant | FW-CRM, FW-TEAM |
| HK-CRM-077 | Real estate mein jeet usi ki jiska data tight hai. | hi-dominant | FW-CRM, FW-AUTHORITY |
| HK-CRM-078 | CRM tumhe rich nahi banata — woh tumhe consistent banata hai, jo rich banata hai. | mixed | FW-CRM, FW-LEAD-LEAKAGE |
| HK-CRM-079 | Tum diary likh rahe ho jabki AI tumhare liye sab note kar sakta hai. | mixed | FW-AI, FW-CRM |
| HK-CRM-080 | CRM ke bina tum har deal naye sire se shuru karte ho — thakaaoot yahi hai. | hi-dominant | FW-CRM, FW-BAB |
| HK-CRM-081 | CRM lena ek kharcha nahi, ek upgrade hai — apne aap ka. | hi-dominant | FW-CRM, FW-OBJECTION |
| HK-CRM-082 | CRM Excel nahi hai — Excel yaad nahi dilata, CRM dilata hai. | hi-dominant | FW-CRM, FW-MYTH |
| HK-CRM-083 | Achha CRM woh hai jo tumhari bhasha samjhe — Hinglish. | mixed | FW-CRM, FW-CONTRARIAN |

## AI (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-AI-001 | AI ne raat 2 baje mere client ko call kiya — subah deal pakki thi. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-002 | Tum follow-up calls karte ho? Mera AI karta hai, main deals close karta hoon. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-003 | 100 cold leads, 1 ghanta, AI ne sab ko call kiya. Tum kya kar rahe ho? | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-004 | AI calling sach mein kaam karti hai? Maine test kiya — proof dekho. | mixed | FW-AI, FW-DEMO |
| HK-AI-005 | Tumhare dead leads zinda ho sakte hain — AI ko call karne do. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-006 | Main 50 calls nahi kar sakta roz, par AI kar sakta hai. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-007 | AI ne mere client se Hinglish mein baat ki — usko pata bhi nahi chala. | mixed | FW-AI, FW-DEMO |
| HK-AI-008 | Tumhari sabse boring kaam — first call — ab AI karega. | mixed | FW-AI, FW-BAB |
| HK-AI-009 | AI follow-up karta hai, tum closing karte ho — yahi future hai. | mixed | FW-AI, FW-AUTHORITY |
| HK-AI-010 | Tum 'baad mein call karunga' bolte ho, AI 'abhi call kar raha hai'. | mixed | FW-AI, FW-CONTRARIAN |
| HK-AI-011 | AI thakta nahi, bhoolta nahi, chutti nahi leta — best employee. | mixed | FW-AI, FW-TEAM |
| HK-AI-012 | Raat ko lead aaya? AI ne turant call kiya, tum so rahe the. | mixed | FW-AI, FW-FOLLOWUP |
| HK-AI-013 | Tumhe lagta hai AI client ko pasand nahi aayega? Test ke result dekho. | mixed | FW-AI, FW-OBJECTION |
| HK-AI-014 | AI ne 200 leads filter kiye — sirf 12 serious nikle. Time bach gaya. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-015 | Future broker AI ke saath kaam karega — baaki peeche reh jayenge. | mixed | FW-AI, FW-CONTRARIAN |
| HK-AI-016 | AI calling ne meri team ka 10 ghanta/hafta bacha diya. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-017 | Tum jise impossible samajhte ho, AI usko routine bana deta hai. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-018 | AI ne client ko call karke site visit book kiya — main sirf gaya. | mixed | FW-AI, FW-DEMO |
| HK-AI-019 | Tumhara competitor AI use kar raha hai — tum manual dial kar rahe ho. | mixed | FW-AI, FW-FEAR |
| HK-AI-020 | AI tumhari jagah nahi le raha — woh tumhe superhuman bana raha hai. | mixed | FW-AI, FW-AUTHORITY |
| HK-AI-021 | Ek hi din mein 100 follow-up calls — sirf AI se possible hai. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-022 | AI har call record karta hai — proof bhi, training bhi. | mixed | FW-AI, FW-TEAM |
| HK-AI-023 | Tum kal ke leads bhool jaate ho, AI kabhi nahi. | mixed | FW-AI, FW-FOLLOWUP |
| HK-AI-024 | AI ko knowledge do, woh client ke har sawaal ka jawab deta hai. | mixed | FW-AI, FW-DEMO |
| HK-AI-025 | Tumhari awaaz nahi, par tumhara kaam — AI 24x7 karta hai. | mixed | FW-AI, FW-BAB |
| HK-AI-026 | Maine AI se cold leads warm karwaye, fir khud close kiya. | mixed | FW-AI, FW-CASE |
| HK-AI-027 | AI tumhari pehli line of defence hai leads ke against — koi miss nahi. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-028 | Tumhe lagta hai AI mehnga hai? Ek extra deal usse zyada hai. | mixed | FW-AI, FW-OBJECTION |
| HK-AI-029 | AI ne mere weekend wapas de diye — calls woh karta hai ab. | mixed | FW-AI, FW-BAB |
| HK-AI-030 | AI calling = scale without hiring. Bina staff, double output. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-031 | Tum ek time pe ek call karte ho, AI sau parallel. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-032 | AI ne meri purani database se 4 lakh nikaal liye. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-033 | Smart broker AI ko intern ki tarah use karta hai — boring kaam ke liye. | mixed | FW-AI, FW-AUTHORITY |
| HK-AI-034 | AI client ka mood samajhta hai — interested ya nahi, turant pata. | mixed | FW-AI, FW-DEMO |
| HK-AI-035 | Tum AI se darte ho? Real darna chahiye AI-wale competitor se. | mixed | FW-AI, FW-FEAR |
| HK-AI-036 | AI tumhare liye qualify karega, tum sirf hot leads pe focus karoge. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-037 | Maine apni saari follow-up calls AI ko di — ab main strategy pe hoon. | mixed | FW-AI, FW-BAB |
| HK-AI-038 | AI calling magic lagta hai — par ye real hai, abhi available hai. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-039 | Tum so jate ho, AI tumhare business ko jagaye rakhta hai. | mixed | FW-AI, FW-FOLLOWUP |
| HK-AI-040 | AI ne client ko reminder call kiya — visit miss nahi hua. | mixed | FW-AI, FW-FOLLOWUP |
| HK-AI-041 | AI sirf bada companies ke liye? Nahi, ab har broker ke liye. | mixed | FW-AI, FW-MYTH |
| HK-AI-042 | Tum manually dial karke thak jaate ho — AI fresh rehta hai. | mixed | FW-AI, FW-BAB |
| HK-AI-043 | AI ne mere 500 leads ko ek hafte mein touch kiya — main akela 5 saal lagata. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-044 | Tumhari team chutti pe hai? AI office chala raha hai. | mixed | FW-AI, FW-TEAM |
| HK-AI-045 | AI calls ka transcript milta hai — kabhi 'usne kya bola' guess nahi. | mixed | FW-AI, FW-CRM |
| HK-AI-046 | Tum AI se replace nahi hoge — par AI use karne wale se hoge. | mixed | FW-AI, FW-CONTRARIAN |
| HK-AI-047 | AI Employee raat-din leads ka jawab de — bina extra staff ke. Raat ko kitne leads aate hain? | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-048 | Client ne socha real banda baat kar raha hai — woh AI tha. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-049 | AI ko knowledge base do — woh tumse better pitch deta hai. | mixed | FW-AI, FW-DEMO |
| HK-AI-050 | Tumhe naya banda hire karne se sasta — AI calling lagana. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-051 | AI raat bhar kaam karta hai, subah report deta hai. Magic? Nahi, tech. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-052 | Tum 'human touch' bolte ho — par follow-up hi nahi karte. AI karta hai. | mixed | FW-AI, FW-CONTRARIAN |
| HK-AI-053 | AI ko ek baar set karo, woh hazaaron calls handle karega. | mixed | FW-AI, FW-DEMO |
| HK-AI-054 | Main field mein hoon, AI office mein calls kar raha hai. | mixed | FW-AI, FW-PROPERTY |
| HK-AI-055 | AI calling se cold list bhi gold list ban sakti hai. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-056 | Tumhe AI seekhna nahi padega — bas use karna aana chahiye. | mixed | FW-AI, FW-OBJECTION |
| HK-AI-057 | AI ne mujhe woh client dilaya jo 1 saal se 'busy' bol raha tha. | mixed | FW-AI, FW-FOLLOWUP |
| HK-AI-058 | Future me do tarah ke broker honge: AI wale, aur band ho chuke. | mixed | FW-AI, FW-CONTRARIAN |
| HK-AI-059 | AI calls karta hai bina judgment, bina mood, har baar consistent. | mixed | FW-AI, FW-AUTHORITY |
| HK-AI-060 | Tumhe AI agent chahiye jo Hindi, English, Marathi — sab bole. | mixed | FW-AI, FW-DEMO |
| HK-AI-061 | AI calling ka demo dekhoge toh manual dialing bhool jaoge. | mixed | FW-AI, FW-DEMO |
| HK-AI-062 | Maine ek hafta AI ko leads diye — meri pipeline phir se zinda hai. | mixed | FW-AI, FW-CASE |
| HK-AI-063 | AI tumhare li------------------ leads ko warm rakhta hai jab tum busy ho. | mixed | FW-AI, FW-FOLLOWUP |
| HK-AI-064 | Smart kaam ye hai: AI ko grunt work do, tum brain ka kaam karo. | mixed | FW-AI, FW-AUTHORITY |
| HK-AI-065 | AI ne mere business ko ek aadmi se ek factory bana diya. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-066 | Tum AI ko 'gimmick' bol rahe ho — woh tumhara competitor ka secret weapon hai. | mixed | FW-AI, FW-FEAR |
| HK-AI-067 | AI calling matlab — kabhi koi lead bina pehle touch ke nahi rahega. | mixed | FW-AI, FW-LEAD-LEAKAGE |
| HK-AI-068 | Main akela tha, ab AI mere saath team jaisa kaam karta hai. | mixed | FW-AI, FW-TEAM |
| HK-AI-069 | AI ko 'try' karo ek hafta — fir batao manual pe wapas jaa sakte ho? | mixed | FW-AI, FW-DEMO |
| HK-AI-070 | Tumhari awaaz mein, tumhari script se — AI calls karega. | mixed | FW-AI, FW-DEMO |
| HK-AI-071 | AI = ek aisa intern jo kabhi resign nahi karta. | mixed | FW-AI, FW-TEAM |
| HK-AI-072 | AI Employee raat ke leads ka jawab de, tum shaam ko ghar jao — raat ko kitne leads aate hain? | mixed | FW-AI, FW-CASE |
| HK-AI-073 | Tum technology se piche ho — par AI tumhe ek raat mein aage la sakta hai. | mixed | FW-AI, FW-BAB |
| HK-AI-074 | AI calling sach hai, aur ye tumhara unfair advantage ban sakta hai. | mixed | FW-AI, FW-CONTRARIAN |
| HK-AI-075 | Tumhari neend important hai — AI ko raat ki shift de do. | mixed | FW-AI, FW-BAB |
| HK-AI-076 | AI ne ek hi shaam mein 80 leads qualify kiye — main 2 hafte lagata. | mixed | FW-AI, FW-CURIOSITY |
| HK-AI-077 | Tum AI ko nahi samajhte? Koi baat nahi — woh tumhe samajhta hai. | mixed | FW-AI, FW-OBJECTION |
| HK-AI-078 | AI tumhare client ko sahi time pe sahi cheez yaad dilata hai. | mixed | FW-AI, FW-FOLLOWUP |
| HK-AI-079 | Maine AI ko apna sabse boring kaam diya — ab main creative hoon. | mixed | FW-AI, FW-BAB |
| HK-AI-080 | AI calling se tumhari agency ek banda nahi, ek system ban jaati hai. | mixed | FW-AI, FW-TEAM |
| HK-AI-081 | AI ne raat bhar leads warm rakhe, tumhe sirf close karna pada. | hi-dominant | FW-AI, FW-FOLLOWUP |
| HK-AI-082 | AI calling — scale without hiring, follow-up without forgetting. | mixed | FW-AI, FW-TEAM |
| HK-AI-083 | Tumhara competitor AI se fast call karta hai — isliye jeetta hai. | hi-dominant | FW-AI, FW-FEAR |

## REAL-ESTATE (84)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-REAL-ESTATE-001 | Real estate mein paisa property se nahi, follow-up se banta hai. | hi-dominant | FW-CONTRARIAN, FW-FOLLOWUP |
| HK-REAL-ESTATE-002 | Broker ka asli asset property nahi — uska data hai. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-REAL-ESTATE-003 | RERA ke baad, jo broker organized nahi, woh survive nahi karega. | mixed | FW-NEWS, FW-AUTHORITY |
| HK-REAL-ESTATE-004 | Mumbai mein deal close karna talent nahi — speed hai. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-005 | Sabse bada broker woh nahi jiske paas zyada property — jiska system best hai. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-REAL-ESTATE-006 | Real estate ek relationship business hai — relationships memory mangti hain. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-007 | Property bik jaati hai, par client zindagi bhar ka hota hai — usko track karo. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-008 | Zyadatar broker real estate ko side income samajh ke chhod dete hain. Galti. | hi-dominant | FW-CONTRARIAN, FW-AUTHORITY |
| HK-REAL-ESTATE-009 | Property dikhana aasaan hai — client ko yaad rakhna mushkil. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-010 | Mumbai-Pune ke broker ek hi galti karte hain: data phone mein rakhte hain. | hi-dominant | FW-AUTHORITY, FW-FEAR |
| HK-REAL-ESTATE-011 | Real estate ka game inventory ka nahi, information ka hai. | hi-dominant | FW-CONTRARIAN, FW-PROPERTY |
| HK-REAL-ESTATE-012 | Jo broker tezi se respond kare, woh hi premium client pakadta hai. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-013 | Property portals mahange ho gaye — par tumhara database free aur sona hai. | mixed | FW-AUTHORITY, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-014 | Real estate mein consistency rare hai — isliye consistent broker rich hai. | mixed | FW-AUTHORITY |
| HK-REAL-ESTATE-015 | Broker bhai, RERA number aur clean data — yahi tumhari credibility hai. | hi-dominant | FW-NEWS, FW-AUTHORITY |
| HK-REAL-ESTATE-016 | Property bik gayi, commission aaya — par usi client se 3 aur deal kahan? | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-017 | Real estate ek long game hai — short memory wala haar jaata hai. | mixed | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-018 | Client ko property nahi, bharosa bechte ho — bharosa system se aata hai. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-019 | Mumbai ka broker jo nahi badla, woh portal ki body shop ban gaya. | hi-dominant | FW-CONTRARIAN, FW-AUTHORITY |
| HK-REAL-ESTATE-020 | Real estate mein referral sabse sasta lead hai — par tum follow-up nahi karte. | mixed | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-021 | Property dekhne wale 10, kharidne wala 1 — baaki 9 ka follow-up karo. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-022 | Real estate ka sabse bada myth: 'mehnat se deal hoti hai'. Nahi — system se. | hi-dominant | FW-MYTH, FW-CRM |
| HK-REAL-ESTATE-023 | Broker ka kaam property bechna nahi — relationship maintain karna hai. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-024 | Mumbai market down ho ya up — organized broker dono mein kamaata hai. | hi-dominant | FW-CONTRARIAN, FW-AUTHORITY |
| HK-REAL-ESTATE-025 | Real estate mein tumhara naam tumhari recall hai — recall data se banta hai. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-026 | Property listing nahi, client need samajhna asli skill hai. | hi-dominant | FW-AUTHORITY, FW-PROPERTY |
| HK-REAL-ESTATE-027 | Pune mein deal speed pe hoti hai — jisne pehle inventory bheji, usne jeeta. | mixed | FW-AUTHORITY, FW-PROPERTY |
| HK-REAL-ESTATE-028 | Broker ka zyada time follow-up me jaana chahiye, lead-hunt me nahi. | mixed | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-REAL-ESTATE-029 | Builder badalta hai, project badalta hai — par tumhara client database stable hai. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-030 | Real estate mein tum jitna yaad rakho, utna kamaao. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-031 | Mumbai broker ka secret: har client ki shaadi-anniversary bhi yaad. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-032 | Property bechna seekho mat — relationship banana seekho. Property to bik jayegi. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-033 | Real estate ki sabse badi capital? Tumhari past clients ki list. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-034 | Jo broker market ko blame karta hai, woh apne system ko chhupa raha hai. | hi-dominant | FW-CONTRARIAN, FW-AUTHORITY |
| HK-REAL-ESTATE-035 | RERA, GST, paperwork — sab track karna padta hai. Diary se nahi hoga. | mixed | FW-NEWS, FW-CRM |
| HK-REAL-ESTATE-036 | Real estate mein har 'NO' ek 'baad mein' hai — usko track karo. | hi-dominant | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-037 | Property dikhane ke baad ka follow-up — yahi pe asli broker bante hain. | hi-dominant | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-038 | Mumbai ka rent market chaotic hai — jiska system tight, uski deals fast. | mixed | FW-AUTHORITY, FW-PROPERTY |
| HK-REAL-ESTATE-039 | Real estate ek phone business ban gaya hai — toh phone ko CRM banao. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-040 | Broker ki value uske inventory mein nahi, uske network mein hai. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-041 | Real estate mein luck nahi, follow-up frequency deal karwati hai. | hi-dominant | FW-FOLLOWUP, FW-CONTRARIAN |
| HK-REAL-ESTATE-042 | Pune ke top broker portal pe kam, apne database pe zyada nirbhar hain. | mixed | FW-AUTHORITY |
| HK-REAL-ESTATE-043 | Property bechne wala broker ordinary hai — relationship banane wala legend. | hi-dominant | FW-AUTHORITY |
| HK-REAL-ESTATE-044 | Real estate ka sabse mehnga galti: client ko ek baar mein 'lost' samajhna. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-045 | Mumbai mein deal usko milti hai jiska response sabse tez hai. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-046 | Tumhara competitor RERA-compliant aur organized hai — tum? | mixed | FW-NEWS, FW-AUTHORITY |
| HK-REAL-ESTATE-047 | Real estate ka long-term khel: aaj ka tenant kal ka buyer hai. Track karo. | hi-dominant | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-048 | Property listing daily badalti hai — tumhari memory keep up nahi karegi. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-REAL-ESTATE-049 | Real estate broker ki asli net worth: uski organized client list. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-050 | Mumbai ho ya Pune — jeet uski jo client ko sabse jaldi wapas call kare. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-051 | Real estate mein 'main yaad rakhunga' sabse mehnga jhooth hai. | hi-dominant | FW-FOLLOWUP, FW-MISTAKE |
| HK-REAL-ESTATE-052 | Property se zyada important hai — kis client ne kya manga, kab. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-REAL-ESTATE-053 | Broker bhai, deals season pe nahi, system pe depend hoti hain. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-REAL-ESTATE-054 | Real estate game ka raaz: jo lead ko sabse zyada touch kare, woh jeete. | hi-dominant | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-055 | Mumbai property mehngi hai — toh ek bhi lost lead aur mehnga. | mixed | FW-AUTHORITY, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-056 | Real estate mein scaling property se nahi — process se hoti hai. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-REAL-ESTATE-057 | Client ki requirement badalti rehti hai — track na karo toh deal slip. | hi-dominant | FW-FOLLOWUP, FW-PROPERTY |
| HK-REAL-ESTATE-058 | Real estate mein tumhari sabse profitable property — purana client. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-059 | Pune broker, ek baat yaad rakho: data tumhara dukaan hai, property nahi. | mr-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-060 | Real estate mein jo dikhta hai woh bikta hai — par jo yaad rehta hai woh jeetta hai. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-061 | Broker bante 100 hain, tikte 5 — fark? System aur follow-up. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-REAL-ESTATE-062 | Real estate ke har deal mein 3 aur deal chhupi hain — relationship rakho. | hi-dominant | FW-FOLLOWUP, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-063 | Mumbai market ka kadwa sach: speed-to-lead hi survival hai. | mixed | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-064 | Real estate mein tumhara mobile tumhara office hai — usko upgrade karo. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-065 | Property aaj hai kal nahi — par organized client list permanent hai. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-066 | Broker ka sabse bada competitor woh broker hai jo time pe call uthata hai. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-067 | Real estate mein har handshake ke baad ek follow-up due hota hai. | hi-dominant | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-068 | Mumbai mein deal milti usko jo 'available' rehta hai — system available rakhta hai. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-069 | Real estate ka asli skill: 6 mahine baad bhi client ka context yaad ho. | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-REAL-ESTATE-070 | Property bechna art hai, par client manage karna science — science seekho. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-071 | Real estate mein tumhe agla unicorn nahi banna — bas organized banna hai. | mixed | FW-CRM, FW-CONTRARIAN |
| HK-REAL-ESTATE-072 | Mumbai ka har broker busy hai — par sirf organized waale profitable hain. | hi-dominant | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-073 | Real estate mein jeet ki recipe: fast response + zero forgotten leads. | mixed | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-074 | Builder relationship banao, par client database usse zyada sambhalo. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-075 | Real estate mein har subah ek question: aaj kis client ko call karna hai? | hi-dominant | FW-FOLLOWUP, FW-CRM |
| HK-REAL-ESTATE-076 | Property ka rate badalta hai — par disciplined broker ki growth nahi. | hi-dominant | FW-CONTRARIAN, FW-AUTHORITY |
| HK-REAL-ESTATE-077 | Real estate mein tum jitne approachable, utne deals — system available rakhta hai. | hi-dominant | FW-AUTHORITY, FW-CRM |
| HK-REAL-ESTATE-078 | Pune real estate mein marathi client trust deta hai jab tum yaad rakho. | mr-dominant | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-079 | Real estate ka sach: commission organized brokers ke paas jaata hai. | mixed | FW-AUTHORITY, FW-LEAD-LEAKAGE |
| HK-REAL-ESTATE-080 | Broker bhai, market ko blame karna band karo — apna system theek karo. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-REAL-ESTATE-081 | Real estate mein tumhara naam tumhare follow-up se banta hai. | hi-dominant | FW-FOLLOWUP, FW-AUTHORITY |
| HK-REAL-ESTATE-082 | Real estate mein fast reply hi sabse badi USP hai. | mixed | FW-AUTHORITY, FW-FOLLOWUP |
| HK-REAL-ESTATE-083 | Mumbai-Pune ka jeetne wala broker system se kaam karta hai. | mixed | FW-AUTHORITY, FW-CONTRARIAN |
| HK-REAL-ESTATE-084 | Buyer time pe response chahta hai, perfect ghar baad mein. | hi-dominant | FW-AUTHORITY, FW-FOLLOWUP |

## AGENCY-GROWTH (83)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-AGENCY-GROWTH-001 | Agency badhani hai? Pehle leak band karo, fir agent badhao. | hi-dominant | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-AGENCY-GROWTH-002 | 5 agent rakhna aasaan hai — 5 agent ko track karna asli kaam hai. | hi-dominant | FW-TEAM |
| HK-AGENCY-GROWTH-003 | Agency tab grow karti hai jab business tum pe nahi, system pe chale. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-004 | Tum naye agent hire kar rahe ho — par data dene ke liye system kahan? | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-005 | Solo broker se agency banna — ek system ki doori hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-006 | Agency ki growth tumhare control mein hai — bas tum dekh nahi paa rahe. | hi-dominant | FW-TEAM |
| HK-AGENCY-GROWTH-007 | Bina dashboard ke agency chalana — andhere mein ship chalana hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-008 | Tumhari agency tab tak nahi badhegi jab tak tum har deal mein nahi. | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-AGENCY-GROWTH-009 | Scaling ka matlab zyada chaos nahi — zyada system hai. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-010 | Tumhari agency ka ceiling tumhari memory hai — usko hatao. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-011 | 10 agent, 10 alag tarike — yahi pe agency bikharti hai. | hi-dominant | FW-TEAM |
| HK-AGENCY-GROWTH-012 | Agency growth = predictable process, na ki har mahine ka jugaad. | mixed | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-013 | Tum agency ke malik ho ya har deal ke clerk? System tumhe malik banata hai. | hi-dominant | FW-CONTRARIAN, FW-TEAM |
| HK-AGENCY-GROWTH-014 | Agency badhane se pehle, leakage band karo — varna bada leak banega. | hi-dominant | FW-LEAD-LEAKAGE, FW-TEAM |
| HK-AGENCY-GROWTH-015 | Tumhari agency ka asli problem manpower nahi, system hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-016 | Ek agency jo har lead track kare, woh kabhi shrink nahi hoti. | hi-dominant | FW-LEAD-LEAKAGE, FW-TEAM |
| HK-AGENCY-GROWTH-017 | Agency owner ka kaam micromanage nahi — system set karna hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-018 | Tumhare agent leave kar de toh agency hil jaati hai — ye warning sign hai. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-AGENCY-GROWTH-019 | Agency scale tab hoti hai jab naya banda din 1 se productive ho. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-020 | Tumhe 100 leads nahi chahiye — ek system chahiye jo 100 handle kare. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-021 | Growth ka raaz: jo kaam tum karte ho, woh tumhare bina bhi ho. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-022 | Agency ka size matter nahi karta — uska system karta hai. | hi-dominant | FW-TEAM, FW-AUTHORITY |
| HK-AGENCY-GROWTH-023 | Tum hire karte raho, par bina system woh sab chaos badhayenge. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-024 | Agency growth ka pehla step: har lead ka ek owner ho. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-AGENCY-GROWTH-025 | Tumhari agency tab tak choti rahegi jab tak tum 'sab khud' karte raho. | hi-dominant | FW-CONTRARIAN, FW-TEAM |
| HK-AGENCY-GROWTH-026 | Scaling ke liye paisa nahi, process chahiye — process system deta hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-027 | Agency owner ki neend system se aati hai, mehnat se nahi. | hi-dominant | FW-TEAM, FW-BAB |
| HK-AGENCY-GROWTH-028 | Tum sirf isliye stuck ho kyunki sab kuch tumhare dimaag mein hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-029 | Growth chaos ko amplify karta hai — pehle order banao. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-030 | Agency ko brand banane ke liye consistency chahiye — system deta hai. | hi-dominant | FW-TEAM, FW-AUTHORITY |
| HK-AGENCY-GROWTH-031 | Tum 1 crore karte ho akele — system se 3 crore team se ho sakta hai. | mixed | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-AGENCY-GROWTH-032 | Agency ki sehat ka thermometer: tumhari pipeline ki visibility. | mixed | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-AGENCY-GROWTH-033 | Tum agency badhate ho leads se — par leads sambhalta kaun? | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-034 | Growth ek event nahi, ek system ka output hai. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-035 | Tumhari agency tumhare bina ek din na chale? Toh tumne business nahi, job banayi. | hi-dominant | FW-CONTRARIAN, FW-TEAM |
| HK-AGENCY-GROWTH-036 | Agency growth ka enemy: founder dependency. System usko todta hai. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-037 | Tum chahe 2 ho ya 20 — bina system, sab ek doosre ke kaam mein takraaoge. | hi-dominant | FW-TEAM |
| HK-AGENCY-GROWTH-038 | Agency ki growth tumhare data ki cleanliness pe atki hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-039 | Tum naye office kholte ho, par purane leads abhi tak leak ho rahe. | hi-dominant | FW-LEAD-LEAKAGE, FW-TEAM |
| HK-AGENCY-GROWTH-040 | Agency owner banna hai? Pehle khud ko deal se replace karo, system se. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-041 | Growth tab predictable hai jab tum har number dekh sakte ho. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-042 | Tumhari agency ke 3 agent rockstar hain, baaki dikhte nahi — system dikhayega. | hi-dominant | FW-TEAM |
| HK-AGENCY-GROWTH-043 | Agency growth ka raaz: lead leak band, follow-up poora. | mixed | FW-LEAD-LEAKAGE, FW-FOLLOWUP |
| HK-AGENCY-GROWTH-044 | Tum agency ko badhana chahte ho par data alag-alag phones mein hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-045 | Scaling karna hai toh handover smooth hona chahiye — system se hota hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-046 | Agency ki sabse badi cost: invisible leakage. Pehle usko maaro. | mixed | FW-LEAD-LEAKAGE, FW-TEAM |
| HK-AGENCY-GROWTH-047 | Tum growth ke liye marketing dhoondte ho — pehle conversion theek karo. | mixed | FW-CONTRARIAN, FW-LEAD-LEAKAGE |
| HK-AGENCY-GROWTH-048 | Agency tab tak nahi badhegi jab tak har agent accountable na ho. | hi-dominant | FW-TEAM |
| HK-AGENCY-GROWTH-049 | Growth = tumhari best practice har agent tak pahunche, system se. | mixed | FW-TEAM |
| HK-AGENCY-GROWTH-050 | Tumhari agency ek aadmi ke phone pe khadi hai — ye risky model hai. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-AGENCY-GROWTH-051 | Agency owner, tumhari growth tumhari worst-tracked lead jitni hai. | mixed | FW-LEAD-LEAKAGE, FW-TEAM |
| HK-AGENCY-GROWTH-052 | Bade banne ke liye, pehle organized bano — order pehle, scale baad. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-053 | Tum agency owner ho — par abhi bhi sabse zyada calls tum karte ho. Kyun? | hi-dominant | FW-CONTRARIAN, FW-CRM |
| HK-AGENCY-GROWTH-054 | Agency growth ka secret weapon: data jo decisions deta hai. | mixed | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-055 | Tum office bade karte ho, par system chhota hi rahta hai — wahi bottleneck. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-056 | Agency scale ke liye paisa second hai — process first hai. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-057 | Tumhari agency ka future tumhare data ke safety pe tika hai. | hi-dominant | FW-FEAR, FW-TEAM |
| HK-AGENCY-GROWTH-058 | Growth tumhe tab tak nahi milega jab tak tum repeat business na track karo. | hi-dominant | FW-FOLLOWUP, FW-TEAM |
| HK-AGENCY-GROWTH-059 | Ek agency, ek dashboard, ek truth — yahi growth ki neev hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-060 | Tum chhote isliye nahi ho ki market chhota hai — tum disorganized ho. | hi-dominant | FW-CONTRARIAN, FW-TEAM |
| HK-AGENCY-GROWTH-061 | Agency growth ka pehla KPI: kitne leads bina action ke pade hain. | mixed | FW-LEAD-LEAKAGE, FW-TEAM |
| HK-AGENCY-GROWTH-062 | Tum agents add karte ho, par accountability add nahi karte — wahi galti. | hi-dominant | FW-TEAM |
| HK-AGENCY-GROWTH-063 | Agency ki growth ek marathon hai — system stamina deta hai. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-064 | Tum 'agar mere agent achhe hote' bolte ho — shayad system kharab hai. | hi-dominant | FW-TEAM, FW-CONTRARIAN |
| HK-AGENCY-GROWTH-065 | Agency double karni hai? Bina ek bhi naya lead, sirf process tight karo. | hi-dominant | FW-LEAD-LEAKAGE |
| HK-AGENCY-GROWTH-066 | Tumhari agency growth ke liye taiyaar nahi — kyunki tumhara data ready nahi. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-067 | Growth ka matlab zyada deals nahi — zyada repeatable deals. | mixed | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-068 | Tum agency ko brand banaao — brand consistency se banta hai, system se. | hi-dominant | FW-AUTHORITY, FW-TEAM |
| HK-AGENCY-GROWTH-069 | Agency owner ki sabse badi galti: sab khud sambhalne ki koshish. | hi-dominant | FW-CONTRARIAN, FW-TEAM |
| HK-AGENCY-GROWTH-070 | Tumhari growth ruk gayi? Tumhara system tumhari mehnat se chhota reh gaya. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-071 | Agency scale = tum chhutti pe jao, aur business chalti rahe. | hi-dominant | FW-TEAM, FW-BAB |
| HK-AGENCY-GROWTH-072 | Tum jitna system pe invest karoge, utna agency tum pe nirbhar nahi rahegi. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-073 | Growth ki recipe: visible pipeline + accountable team + zero leakage. | mixed | FW-TEAM |
| HK-AGENCY-GROWTH-074 | Tum aaj bhi 2 saal pehle wale tarike se chal rahe ho — wahi tumhara cap hai. | hi-dominant | FW-CONTRARIAN, FW-TEAM |
| HK-AGENCY-GROWTH-075 | Agency tab badi hoti hai jab har choti cheez track hoti hai. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-076 | Tum growth chahte ho par chaos pal rahe ho — dono saath nahi chalte. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-077 | Agency ki asli scale tab hoti hai jab knowledge agent ke saath na jaaye. | hi-dominant | FW-TEAM, FW-CRM |
| HK-AGENCY-GROWTH-078 | Tumhari agency ki growth story system se shuru hoti hai, hustle se nahi. | hi-dominant | FW-CRM, FW-TEAM |
| HK-AGENCY-GROWTH-079 | Owner bhai, agency ki growth aapke control mein hai — bas system pakado. | hi-dominant | FW-TEAM, FW-AUTHORITY |
| HK-AGENCY-GROWTH-080 | Agents nahi, system scale karta hai agency ko. | mixed | FW-TEAM, FW-CONTRARIAN |
| HK-AGENCY-GROWTH-081 | Owner bottleneck ban gaya toh growth ruk gayi. | hi-dominant | FW-TEAM, FW-FOUNDER |
| HK-AGENCY-GROWTH-082 | Sabse sasti growth: kho chuke leads wapas laao. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-AGENCY-GROWTH-083 | Repeatable process ke bina har naya hire ek naya jua. | hi-dominant | FW-TEAM |

## WHATSAPP-CHAOS (84)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-WHATSAPP-CHAOS-001 | 200 unread WhatsApp messages — usme ek deal dabi hai. Kaunsi? | mixed | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-002 | WhatsApp pe leads dhundhna — kachre mein heera dhundhne jaisa. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-003 | 'Woh client kaunsa tha jisne 3BHK pucha tha?' — WhatsApp scroll karte raho. | hi-dominant | FW-WHATSAPP-CHAOS, FW-PROPERTY |
| HK-WHATSAPP-CHAOS-004 | WhatsApp delete kiya galti se — 6 mahine ke leads gaye. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-005 | Tum WhatsApp ko CRM samajh rahe ho — wahi sabse badi galti hai. | mixed | FW-WHATSAPP-CHAOS, FW-MYTH |
| HK-WHATSAPP-CHAOS-006 | WhatsApp pe 'pin' kiya tha — par ab 15 pinned hain, koi pin nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-007 | Lead WhatsApp pe aaya 9 baje, dab gaya group messages ke neeche, deal gayi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-008 | Tumhare best leads forwarded memes ke beech kho gaye hain. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-009 | WhatsApp pe sab hai — isliye kuch nahi milta jab zaroorat ho. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-010 | 'Bhej diya tha' — par kahan, kab, kisko? WhatsApp jawab nahi deta. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-011 | WhatsApp tumhara inbox hai, CRM nahi — usko system mein nikaalo. | mixed | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-012 | Client ne WhatsApp pe budget bataya tha — ab kahan hai woh message? | hi-dominant | FW-WHATSAPP-CHAOS, FW-PROPERTY |
| HK-WHATSAPP-CHAOS-013 | Tum WhatsApp pe 5 ghante kaam karte ho — usme 1 ghanta productive hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-014 | Naya phone liya — purane chats transfer nahi hue. Business gum. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-015 | WhatsApp pe lead aata hai, par follow-up reminder kaun dega? Koi nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-016 | Tumhari pipeline 4 WhatsApp groups mein bikhri hui hai. | mixed | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-017 | WhatsApp Business bhi CRM nahi hai — woh sirf chat hai. | mixed | FW-WHATSAPP-CHAOS, FW-MYTH |
| HK-WHATSAPP-CHAOS-018 | 'Status' lagane se deal nahi hoti — follow-up se hoti hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-019 | Tum WhatsApp pe property bhejte ho, par kisne dekha pata nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-PROPERTY |
| HK-WHATSAPP-CHAOS-020 | WhatsApp pe 50 chats open — focus kahan? Lead kahan? | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-021 | Tumhe lagta hai WhatsApp organized hai — ek important lead dhoondh ke dikhao. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-022 | WhatsApp ke notifications mein tumhari sabse badi deal chhup gayi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-023 | WhatsApp tumhari diary nahi — usme structure nahi hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-024 | Client ka message 3 din baad dekha — woh tab tak dusre ke paas chala gaya. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-025 | Tumne WhatsApp pe '👍' bheja — par follow-up calendar mein kuch nahi. | mixed | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-026 | WhatsApp pe data tumhara nahi — Meta ka hai. CRM mein woh tumhara hai. | mixed | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-027 | Tumhara agent WhatsApp pe leads handle karta hai — woh resign, leads gone. | hi-dominant | FW-WHATSAPP-CHAOS, FW-TEAM |
| HK-WHATSAPP-CHAOS-028 | WhatsApp pe 'jaldi reply' aadat hai — par bina record, sab bhool jaate ho. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-029 | Tum WhatsApp scroll karte ho lead dhundhne — system mein ek search. | hi-dominant | FW-WHATSAPP-CHAOS, FW-DEMO |
| HK-WHATSAPP-CHAOS-030 | WhatsApp pe 6 mahine purana lead dhoondhna — namumkin task. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-031 | WhatsApp chaos ka matlab — har din ek deal ka khauf. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-032 | Tum WhatsApp ko sambhalte ho, par WhatsApp tumhe sambhal nahi raha. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-033 | Ek client ke 3 alag chats — kaunsa latest hai? Confusion = lost deal. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-034 | WhatsApp pe sab kuch 'temporary' lagta hai — aur temporary cheez gum hoti hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-035 | Tumne kitne leads ko 'baad mein reply' bola aur bhool gaye? | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-036 | WhatsApp se CRM tak — bas yahi ek shift tumhe organize kar dega. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-037 | Tumhari hot lead WhatsApp pe 'last seen' dekh ke chali gayi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-038 | WhatsApp pe property forward karke bhool jaate ho — koi follow-up nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-PROPERTY |
| HK-WHATSAPP-CHAOS-039 | Tum WhatsApp ko zindagi banate ho — par woh tumhe organize nahi banata. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-040 | WhatsApp backup fail ho gaya — ab batao tumhare leads kahan hain. | mixed | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-041 | Group mein lead aaya, 5 agent ne dekha, kisi ne reply nahi kiya. | hi-dominant | FW-WHATSAPP-CHAOS, FW-TEAM |
| HK-WHATSAPP-CHAOS-042 | WhatsApp pe sab busy dikhte hain — par koi accountable nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-TEAM |
| HK-WHATSAPP-CHAOS-043 | Tum WhatsApp pe deals karte ho — par track ek bhi nahi kar paate. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-044 | WhatsApp pe lead ka naam nahi, sirf number — yaad rakhoge kaise? | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-045 | Ek din WhatsApp band hua toh tumhara business band ho jayega. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-046 | Tumhari WhatsApp ki memory full ho gayi — leads ki tarah. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-047 | WhatsApp pe lead ko organize karna — paani ko muthi mein rakhna hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-048 | Tum WhatsApp pe 'fast' ho — par 'organized' nahi. Dono chahiye. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-049 | WhatsApp leads ko system mein daalo — ek baar, fir chain. | hi-dominant | FW-WHATSAPP-CHAOS, FW-DEMO |
| HK-WHATSAPP-CHAOS-050 | Tumhe yaad hai client ne kya manga tha? WhatsApp ko bhi nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-PROPERTY |
| HK-WHATSAPP-CHAOS-051 | WhatsApp pe har lead ek 'unread' ban jaata hai jab tum busy ho. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-052 | Tum WhatsApp pe leads ki 'storage' karte ho — storage matlab dafan. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-053 | Client ne 'flat ka video bhejo' bola — woh message ab 200 neeche hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-PROPERTY |
| HK-WHATSAPP-CHAOS-054 | WhatsApp pe negotiation chal rahi thi — chat dab gaya, deal thand gayi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-055 | Tumhari WhatsApp ek dump hai — CRM ek system hai. Fark samjho. | mixed | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-056 | WhatsApp pe tumne kabhi nahi gina — kitne leads bina reply chale gaye. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-057 | Tum WhatsApp ki notifications mein doob rahe ho — system surface deta hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-058 | WhatsApp pe sab leads same dikhte hain — system priority dikhata hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-059 | Client ka WhatsApp aaya jab tum so rahe the — subah tak deal thandi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-AI |
| HK-WHATSAPP-CHAOS-060 | WhatsApp pe forward ki bheed mein tumhara client wait kar raha hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-061 | Tum WhatsApp ko clean karte ho, par leads bhi clean ho jaate hain. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-062 | WhatsApp pe deal ki history nahi banti — ek hi flow mein sab mix. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-063 | Tum WhatsApp ke gulam ho — system tumhe malik banata hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-BAB |
| HK-WHATSAPP-CHAOS-064 | WhatsApp pe lead pe lead aate hain — par koi sorted nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-065 | Tum 'WhatsApp se kaam ho jaata hai' bolte ho — kitne deal miss hue ginlo. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CONTRARIAN |
| HK-WHATSAPP-CHAOS-066 | WhatsApp tumhe message deta hai, system tumhe deal deta hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-067 | Tumhari aadat WhatsApp pe leads rakhne ki — yahi tumhe roz paisa khila rahi hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-068 | WhatsApp se ek lead nikaalna 5 min — system se 5 second. | hi-dominant | FW-WHATSAPP-CHAOS, FW-DEMO |
| HK-WHATSAPP-CHAOS-069 | Tum WhatsApp pe reply karte raho — par konsa lead hot hai, pata nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-070 | WhatsApp tumhe 24x7 busy rakhta hai — par productive nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-071 | Ek search bar jo tumhe har client turant de — WhatsApp mein nahi hai. | mixed | FW-WHATSAPP-CHAOS, FW-DEMO |
| HK-WHATSAPP-CHAOS-072 | Tumhare WhatsApp pe leads marte hain, aur tumhe khabar bhi nahi hoti. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-073 | WhatsApp pe sab kuch hai par ek bhi follow-up reminder nahi. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |
| HK-WHATSAPP-CHAOS-074 | Tum WhatsApp ko upgrade karne ki socho — apne aap ko upgrade karo, system lo. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-075 | WhatsApp pe lead ka koi 'status' nahi — sab guesswork hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-CRM |
| HK-WHATSAPP-CHAOS-076 | Tum WhatsApp ke notification se ladte raho — ya system se jeet jao. | hi-dominant | FW-WHATSAPP-CHAOS, FW-BAB |
| HK-WHATSAPP-CHAOS-077 | WhatsApp pe lead aaye toh ek tap mein CRM mein daalo — fir chain. | hi-dominant | FW-WHATSAPP-CHAOS, FW-DEMO |
| HK-WHATSAPP-CHAOS-078 | Tum WhatsApp pe deal chala rahe ho — ek din woh sab udd jayega. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-079 | WhatsApp chaos roz tumse ek deal cheen raha hai — chup chaap. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-080 | Tumhe WhatsApp se nafrat nahi — tumhe usme khoye leads se nafrat hai. | hi-dominant | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-081 | WhatsApp tumhara CRM nahi — woh sirf tumhe busy feel karwata hai. | mixed | FW-WHATSAPP-CHAOS, FW-CONTRARIAN |
| HK-WHATSAPP-CHAOS-082 | 200 unread mein ek tumhari next deal dabi hai. | mixed | FW-WHATSAPP-CHAOS, FW-LEAD-LEAKAGE |
| HK-WHATSAPP-CHAOS-083 | Phone gira, WhatsApp gaya, 6 mahine ke leads gaye. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FEAR |
| HK-WHATSAPP-CHAOS-084 | WhatsApp pe wait karaya, client ne dusre ko call kar liya. | hi-dominant | FW-WHATSAPP-CHAOS, FW-FOLLOWUP |

## TEAM-MANAGEMENT (84)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-TEAM-MANAGEMENT-001 | Tumhe sach mein pata hai team aaj kya kar rahi hai? | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-002 | Agent bola 'follow-up kar diya' — proof kahan hai? | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-003 | 5 agent, 5 alag diary — tumhari agency ka data 5 jagah bikhra hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-004 | Tumhara best agent jis din jayega, saara data uske saath jayega. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-005 | Kaun sa agent kitne deals la raha hai — ya tum guess kar rahe ho? | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-006 | Tum team ko micromanage karte ho kyunki tumhe visibility nahi. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-007 | Lead assign kiya — par follow-up hua ya nahi, pata nahi. | hi-dominant | FW-TEAM, FW-FOLLOWUP |
| HK-TEAM-MANAGEMENT-008 | Naya banda aaya — usko sab samjhane mein 2 hafte gaye. System se 2 din. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-009 | Tumhe pata hai kaun sa agent leads sit kar raha hai? | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-010 | Team ka koi banda fraud kare toh tumhe 6 mahine baad pata chalega. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-011 | Tum agent pe trust karte ho — par data tumhare paas hona chahiye. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-012 | Team performance dekhne ke liye tumhe har agent se poochna padta hai? Wrong. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-013 | Tumhari team busy dikhti hai — par output kitna hai? | hi-dominant | FW-TEAM, FW-CONTRARIAN |
| HK-TEAM-MANAGEMENT-014 | Agent resign — clients uske personal WhatsApp pe. Disaster. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-015 | Team ka leaderboard banao — competition khud kaam karega. | hi-dominant | FW-TEAM, FW-CURIOSITY |
| HK-TEAM-MANAGEMENT-016 | Tum agent ko blame karte ho, par usse system kabhi diya hi nahi. | hi-dominant | FW-TEAM, FW-CONTRARIAN |
| HK-TEAM-MANAGEMENT-017 | Har agent ka follow-up rate dekho — wahi tumhari real picture hai. | hi-dominant | FW-TEAM, FW-FOLLOWUP |
| HK-TEAM-MANAGEMENT-018 | Tumhari team mein 1 rockstar, baaki freeloaders — pata bhi hai? | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-019 | Naya banda din 1 se productive ho — agar system ready ho. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-020 | Tum team ko targets dete ho — par track karne ka system nahi. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-021 | Agent ke jaate hi tumhe pata chalta hai woh kitna important tha. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-022 | Team management ka matlab spy karna nahi — visibility rakhna hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-023 | Tum agent ko delete access doge? Ek galti, saara data gaya. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-024 | RBAC matlab: naya banda delete nahi kar sakta, control tumhara. | mixed | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-025 | Tum team ki report banane mein 2 ghante lagate ho — system 1 click. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-026 | Tumhari team kis lead pe atki hai, kahaan stuck — dashboard batayega. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-027 | Agent bola 'lead achha nahi tha' — lekin usne kitne follow-up kiye? | hi-dominant | FW-TEAM, FW-FOLLOWUP |
| HK-TEAM-MANAGEMENT-028 | Team ka data ek jagah ho toh handover bina dard ke hota hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-029 | Tumhe team se zyada apne system pe nirbhar hona chahiye. | hi-dominant | FW-TEAM |
| HK-TEAM-MANAGEMENT-030 | Tum har agent se 'update kya hai' poochte ho — thak gaye? System dega. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-031 | Team mein accountability tab aati hai jab har lead ka owner ho. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-032 | Tum agent ki mehnat dekh nahi paate — sirf result. System effort dikhata hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-033 | Tumhari team ka data tumhara asset hai — phone mein nahi, system mein rakho. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-034 | Agent jo zyada leads chahta hai — pehle uske pending follow-up dekho. | hi-dominant | FW-TEAM, FW-FOLLOWUP |
| HK-TEAM-MANAGEMENT-035 | Team management bina dashboard — andhere mein team ko handle karna. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-036 | Tum top performer ko reward dete ho? Pehle usko identify toh karo. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-037 | Agent har din 'busy' bolta hai — system batayega busy ya productive. | hi-dominant | FW-TEAM, FW-CONTRARIAN |
| HK-TEAM-MANAGEMENT-038 | Tum team ko trust do, par 'trust with verification' — data se. | mixed | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-039 | Team ka har member ek silo hai — system unko ek team banata hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-040 | Tum manager ho ya babysitter? System tumhe manager banata hai. | hi-dominant | FW-TEAM, FW-BAB |
| HK-TEAM-MANAGEMENT-041 | Agent ki performance gut feel se nahi, data se naapo. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-042 | Lead kis agent ke paas atka hai — woh leak point hai. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-043 | Tum team ko scale karte ho, par chaos ko bhi scale kar dete ho. | hi-dominant | FW-TEAM |
| HK-TEAM-MANAGEMENT-044 | Tumhe pata hona chahiye: kis agent ka conversion best hai, aur kyun. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-045 | Naya agent train karna mushkil hai? System usko self-train karta hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-046 | Tum agent ko data dete ho — par woh use le ke nikal jaata hai. Risk. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-047 | Team ke beech lead chori hoti hai — accountability bina ye chalta rehega. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-048 | Tumhari team ka follow-up rate dekho — wahi tumhari income ka raaz hai. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-049 | Agent ko target nahi, clarity do — system clarity deta hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-050 | Tum team ki daily report manually maangte ho — woh auto aa sakti hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-051 | Team ka data leak tumhari sabse badi kamzori hai. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-052 | Tumhare agent ek doosre ke leads pe call kar dete hain — chaos hai. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-053 | Performance reward karna hai? Pehle performance dikhne do — system se. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-054 | Tum poori team ko ek hi nazar mein dekh sako — yahi power hai. | hi-dominant | FW-TEAM, FW-DEMO |
| HK-TEAM-MANAGEMENT-055 | Agent bolta hai 'maine kiya' — system bolta hai 'kab, kya, kitna'. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-056 | Tum agent ko micromanage band karo — system khud track karega. | hi-dominant | FW-TEAM, FW-BAB |
| HK-TEAM-MANAGEMENT-057 | Team ko motivate karne ka best tarika: transparent leaderboard. | hi-dominant | FW-TEAM, FW-CURIOSITY |
| HK-TEAM-MANAGEMENT-058 | Tumhe pata hona chahiye kaun sa lead bina kaam ke pada hai, kis ke paas. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-059 | Agent ke phone mein agency ka data — yeh time bomb hai. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-060 | Tum team ki visibility ke bina growth chahte ho — namumkin. | hi-dominant | FW-TEAM |
| HK-TEAM-MANAGEMENT-061 | Team ka kaam transparent ho toh trust automatic ban jaata hai. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-062 | Tum agent se zyada uske leads track karo — leads agency ke hain. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-063 | Agent ne lead 'apna' bola — par data agency ka hai, ya hona chahiye. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-064 | Tumhari team mein invisible leakage hai — har agent thoda thoda chhodta hai. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-065 | Team management ka pehla rule: har lead trackable, har agent accountable. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-066 | Tum team ke saath grow karna chahte ho — pehle visibility set karo. | hi-dominant | FW-TEAM |
| HK-TEAM-MANAGEMENT-067 | Naya joiner aaye toh role-based access do — sab ko sab access mat do. | mixed | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-068 | Tum agent ki performance review karte ho yaadon se — data se karo. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-069 | Tumhari team busy hai par numbers flat — woh activity bina output hai. | hi-dominant | FW-TEAM, FW-CONTRARIAN |
| HK-TEAM-MANAGEMENT-070 | Agent jise tum star samajhte ho, shayad woh leads sit kar raha hai. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-071 | Team ka data central ho toh tum chhutti pe bhi control mein rehte ho. | hi-dominant | FW-TEAM, FW-BAB |
| HK-TEAM-MANAGEMENT-072 | Tum manager banna chahte ho? Pehle apni team ko dekhna seekho — system se. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-073 | Agent ka excuse 'lead achha nahi tha' — data usko sach ya jhooth banata hai. | hi-dominant | FW-TEAM, FW-CONTRARIAN |
| HK-TEAM-MANAGEMENT-074 | Tum poori team ka follow-up ek screen pe dekh sako — yahi sapna hai. | hi-dominant | FW-TEAM, FW-DEMO |
| HK-TEAM-MANAGEMENT-075 | Tumhari agency ka future tumhare data control pe atka hai, team pe nahi. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-076 | Team ko aaj se accountable banao — har lead ek owner, har action ek log. | hi-dominant | FW-TEAM, FW-LEAD-LEAKAGE |
| HK-TEAM-MANAGEMENT-077 | Tum agent ki tareef karo ya daanto — pehle data dekho, mood nahi. | hi-dominant | FW-TEAM, FW-CRM |
| HK-TEAM-MANAGEMENT-078 | Team ka performance gap aksar follow-up gap hota hai. | hi-dominant | FW-TEAM, FW-FOLLOWUP |
| HK-TEAM-MANAGEMENT-079 | Tum team manage karte ho ya team tumhe? System tumhe control deta hai. | hi-dominant | FW-TEAM, FW-BAB |
| HK-TEAM-MANAGEMENT-080 | Tumhari sabse badi team risk: data ka ek aadmi pe depend hona. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-081 | 'Follow-up kiya' — proof system mein hai ya sirf zubaan pe? | hi-dominant | FW-TEAM, FW-CONTRARIAN |
| HK-TEAM-MANAGEMENT-082 | Agent gaya toh data bhi gaya — yeh tabhi jab system na ho. | hi-dominant | FW-TEAM, FW-FEAR |
| HK-TEAM-MANAGEMENT-083 | Owner ka control micromanage se nahi, visibility se aata hai. | hi-dominant | FW-TEAM, FW-FOUNDER |
| HK-TEAM-MANAGEMENT-084 | Fair lead rotation se sabse weak agent bhi grow karta hai. | mixed | FW-TEAM |

## PROPERTY-MANAGEMENT (84)

| ID | Hook | Lang | Best Frameworks |
|---|---|---|---|
| HK-PROPERTY-MANAGEMENT-001 | Client bola '2BHK Andheri mein' — tumne phone mein 10 min dhoondha. Deal slow. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-002 | Property turant share karo — warna client doosre broker ke paas chala jayega. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-003 | Tumhari saari inventory ek jagah ho toh deal speed double ho jaati hai. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-004 | Client ka requirement yaad nahi — fir property match kaise karoge? | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-005 | Property photos 5 alag chats mein bikhre hain — ek jagah lao. | hi-dominant | FW-PROPERTY, FW-WHATSAPP-CHAOS |
| HK-PROPERTY-MANAGEMENT-006 | Inventory at fingertips — yahi fark hai pro aur amateur broker mein. | mixed | FW-PROPERTY, FW-AUTHORITY |
| HK-PROPERTY-MANAGEMENT-007 | Tum jise 'busy' bolte ho, woh property dhoondhne ka time waste hai. | hi-dominant | FW-PROPERTY, FW-CONTRARIAN |
| HK-PROPERTY-MANAGEMENT-008 | Client call pe hai, tum property ka rate dhoondh rahe ho — woh wait nahi karega. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-009 | Property ka status — available, booked, sold — track karte ho ya guess? | mixed | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-010 | Tum same property 2 clients ko bech dete ho — double booking disaster. | hi-dominant | FW-PROPERTY, FW-FEAR |
| HK-PROPERTY-MANAGEMENT-011 | Buyer ki need aur property ka match — ek click mein ho sakta hai. | mixed | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-012 | Property dikhane ke baad detail bhejna bhool gaye — lead thandi. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-013 | Tumhari inventory tumhare dimaag mein hai — dimaag scale nahi karta. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-014 | Client ne pucha 'us flat ka kya hua?' — tum blank ho gaye. Trust gaya. | hi-dominant | FW-PROPERTY, FW-FEAR |
| HK-PROPERTY-MANAGEMENT-015 | Property share karne mein 3 tap — phir client ka jawab dekho. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-016 | Tum property ke documents dhoondhte raho — system ek folder mein rakhta hai. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-017 | Inventory update na ho toh tum sold flat dikhate raho ge — embarrassing. | hi-dominant | FW-PROPERTY, FW-FEAR |
| HK-PROPERTY-MANAGEMENT-018 | Client ko sahi property dikhao — uski requirement ka record rakho. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-019 | Property ka rate, area, floor — sab ek jagah, har waqt updated. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-020 | Tumhare paas 50 properties hain par koi search nahi — useless inventory. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-021 | Client requirement set karo, system matching property dikhayega. | hi-dominant | FW-PROPERTY, FW-AI |
| HK-PROPERTY-MANAGEMENT-022 | Tum property bhejte ho, par kisne dekha track nahi — wahi follow-up gap. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-023 | Property ka location map pe pin karo — client ko clarity, tumhe credibility. | mixed | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-024 | Tumhari inventory speed = tumhari deal speed. Slow inventory, slow deals. | mixed | FW-PROPERTY, FW-CONTRARIAN |
| HK-PROPERTY-MANAGEMENT-025 | Property detail har baar type karna — system ek baar save, baar baar share. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-026 | Client ko 2 minute mein 5 matching options bhej do — deal warm. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-027 | Tum rented properties ka track nahi rakhte — renewal miss ho jaata hai. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-028 | Property ki PDF, photo, video — ek jagah, ek client ko ek tap. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-029 | Inventory bikhri hai? Toh client experience bhi bikhra hua hai. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-030 | Tum property dhoondhne mein deal ka momentum kho dete ho. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-031 | Client ki budget aur area note rakho — fir perfect match dikhao. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-032 | Property bik gayi par inventory mein abhi bhi 'available' — chaos. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-033 | Tum building ke flats ka track manually rakhte ho — galti hone wali hai. | hi-dominant | FW-PROPERTY, FW-FEAR |
| HK-PROPERTY-MANAGEMENT-034 | Inventory organized ho toh tum confident dikhte ho — client buy karta hai. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-035 | Property requirement aur availability ko match karna — system ka kaam, dimaag ka nahi. | hi-dominant | FW-PROPERTY, FW-AI |
| HK-PROPERTY-MANAGEMENT-036 | Tum client ko 'main check karke batata hoon' bolte ho — woh ruk nahi raha. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-037 | Property listing ek jagah ho toh team bhi same inventory bechti hai. | hi-dominant | FW-PROPERTY, FW-TEAM |
| HK-PROPERTY-MANAGEMENT-038 | Client requirement badalti rehti hai — track karo varna galat property dikhaoge. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-039 | Tumhe pata hona chahiye kaun si property kis client ko dikhayi. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-040 | Property ke saath uska owner, rate, status — sab ek profile mein. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-041 | Tum property ka rate yaad rakhte ho? 50 properties ka? Namumkin. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-042 | Inventory turant share = client impressed = deal fast. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-043 | Property management ka matlab sirf list nahi — match + share + track. | mixed | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-044 | Tum property dhoondhne mein jitna time lagte ho, deal utni thandi hoti hai. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-045 | Client ne 6 mahine pehle dekhi property ab afford kar sakta hai — track tha? | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-046 | Property photos quality matter karti hai — par organization usse zyada. | mixed | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-047 | Tum inventory ek app mein rakho — field mein bhi sab access. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-048 | Client requirement capture karo first call pe — fir har baar relevant raho. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-049 | Property ka document missing ho toh deal ruk jaati hai — sab ek jagah rakho. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-050 | Tumhari inventory tumhara sabse bada asset hai — usko organize karo. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-051 | Property match karna art nahi, system hai — buyer need + inventory. | mixed | FW-PROPERTY, FW-AI |
| HK-PROPERTY-MANAGEMENT-052 | Tum client ke saamne fumble karte ho — kyunki property ka data ready nahi. | hi-dominant | FW-PROPERTY, FW-FEAR |
| HK-PROPERTY-MANAGEMENT-053 | Property turant nikalo, client ko wait mat karwao — system se possible. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-054 | Inventory ke bina updated status — sold ko available dikhana, sharminda hona. | hi-dominant | FW-PROPERTY, FW-FEAR |
| HK-PROPERTY-MANAGEMENT-055 | Tum property ko WhatsApp pe bhejte ho — par track nahi, follow-up nahi. | hi-dominant | FW-PROPERTY, FW-WHATSAPP-CHAOS |
| HK-PROPERTY-MANAGEMENT-056 | Property profile mein owner ka contact bhi ho — turant deal aage badhe. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-057 | Client ko 5 options ek message mein — yahi professional broker karta hai. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-058 | Tumhe yaad nahi kaunsi property available hai — system ko hamesha yaad. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-059 | Property ki har detail ek baar daalo, hazaaron baar use karo. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-060 | Inventory organized = client ka trust = repeat business. | hi-dominant | FW-PROPERTY, FW-LEAD-LEAKAGE |
| HK-PROPERTY-MANAGEMENT-061 | Tum rented property ka renewal date track nahi karte — paisa table pe. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-062 | Property aur buyer ka perfect match — yahi pe commission banta hai. | hi-dominant | FW-PROPERTY, FW-LEAD-LEAKAGE |
| HK-PROPERTY-MANAGEMENT-063 | Tum property ko phone gallery mein rakhte ho — usme search nahi hai. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-064 | Inventory tight ho toh tum kisi bhi client ko 2 min mein serve kar sakte ho. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-065 | Property listing daily badalti hai — manual track impossible hai. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-066 | Client ka dream home tumhari inventory mein hai — par tumhe nahi pata. | hi-dominant | FW-PROPERTY, FW-LEAD-LEAKAGE |
| HK-PROPERTY-MANAGEMENT-067 | Tum property dhoondhte raho, competitor share kar chuka — speed sab hai. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-068 | Inventory ek jagah, team sab dekh sake — duplicate effort khatam. | hi-dominant | FW-PROPERTY, FW-TEAM |
| HK-PROPERTY-MANAGEMENT-069 | Property ka rate change hua — pura team ko pata chale, ek jagah update. | hi-dominant | FW-PROPERTY, FW-TEAM |
| HK-PROPERTY-MANAGEMENT-070 | Tum client ki requirement bhool jaate ho — system har detail rakhta hai. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-071 | Property management = deal ki speed. Slow inventory = lost deal. | mixed | FW-PROPERTY, FW-CONTRARIAN |
| HK-PROPERTY-MANAGEMENT-072 | Tum property bechne jaate ho bina ready data ke — wahi unprofessional dikhta hai. | hi-dominant | FW-PROPERTY, FW-FOLLOWUP |
| HK-PROPERTY-MANAGEMENT-073 | Inventory mein har property ka ek profile — photo, rate, status, owner. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-074 | Tum client ko property dikhao 2 minute mein — woh impress hoke ruk jaayega. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-075 | Property ko organize karna boring lagta hai — par yahi deal jeetta hai. | hi-dominant | FW-PROPERTY, FW-CONTRARIAN |
| HK-PROPERTY-MANAGEMENT-076 | Tumhari inventory phone ki gallery mein dafan hai — usko system mein jaga do. | hi-dominant | FW-PROPERTY, FW-CRM |
| HK-PROPERTY-MANAGEMENT-077 | Client requirement match karne ka sabse fast tarika: organized inventory. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-078 | Property ka video, photo, price — ek tap pe client ke paas, professional vibe. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-079 | Tum same property baar baar describe karte ho — ek baar save karo bhai. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-080 | Inventory speed pe deal banti hai — phone gallery se nahi, system se. | hi-dominant | FW-PROPERTY, FW-CONTRARIAN |
| HK-PROPERTY-MANAGEMENT-081 | Property management se buyer-property matching ek science ban jaati hai. | mixed | FW-PROPERTY, FW-AI |
| HK-PROPERTY-MANAGEMENT-082 | Client poochta hai '3BHK hai kya', tum 30 second mein 5 options do. | hi-dominant | FW-PROPERTY, FW-DEMO |
| HK-PROPERTY-MANAGEMENT-083 | Bika hua flat available dikhaya — rishta ek second mein khatam. | hi-dominant | FW-PROPERTY, FW-FEAR |
| HK-PROPERTY-MANAGEMENT-084 | Sahi buyer ko sahi property — memory se nahi, matching se. | mixed | FW-PROPERTY, FW-CRM |

