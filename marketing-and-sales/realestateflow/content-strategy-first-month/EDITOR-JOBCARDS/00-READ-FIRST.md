# READ FIRST (only once)

Hi. Ye folder aapke liye hai. Baaki files mat kholo. Sirf yahi folder.

**Rule: 1 video = 1 file.** Aapko jo video banana hai, uski file kholo. Sab kuch usme hai.

---

## Aapko kitne video banane hain

**13 videos. 4 weeks. Har week 3 video.**

| Week | Videos | Deliver by |
|---|---|---|
| Week 1 | R01, R03, R04 | Sat 9 Aug |
| Week 2 | R05, R08 | Sat 16 Aug |
| Week 3 | R09, R10, R12, R13 | Sat 23 Aug |
| Week 4 | R14, R15, R17, R18 | Sat 30 Aug |

**R09 aur R14 sabse important hain.** In dono ko 2 din do. Baaki 1 din.

---

## Har video ki file kaise kholo

| Video | File | Kya hai |
|---|---|---|
| R01 | `R01.md` | Raat ke 11:47 |
| R03 | `R03.md` | Employee resign karta hai (BIG) |
| R04 | `R04.md` | Independence Day |
| R05 | `R05.md` | 15,000 kiska hai |
| R08 | `R08.md` | Buyer builder ko direct (BIG) |
| R09 | `R09.md` | THE THESIS (BIGGEST) |
| R10 | `R10.md` | Screen demo 1 |
| R12 | `R12.md` | Screen demo 2 Khata |
| R13 | `R13.md` | Hum ye kyun bana rahe hain |
| R14 | `R14.md` | THE REVEAL (BIGGEST) |
| R15 | `R15.md` | WhatsApp Se Puchho 1 |
| R17 | `R17.md` | WhatsApp Se Puchho 2 |
| R18 | `R18.md` | Founding 50 |

---

## EXPORT SETTINGS (sab video ke liye same)

```
Size        1080 x 1920  (9:16 vertical)
FPS         30
Format      MP4, H.264
Bitrate     10 to 15 Mbps
Audio       AAC, 48kHz, loudness -14 LUFS
```

**2 file dena hai har video ka:**
1. `REF-R01-v1.mp4`          (captions ke saath)
2. `REF-R01-v1-noCC.mp4`     (captions ke bina)

---

## SAFE ZONE (bahut important)

Instagram upar aur neeche ka area dhak deta hai. Text wahan mat rakho.

```
1080 x 1920

TOP     0 se 220 px      = DEAD. Yahan kuch mat rakho.
MIDDLE  220 se 1500 px   = SAFE. Sab text yahan.
                           Captions yahan rakho: 1050 se 1250 px
BOTTOM  1500 se 1920 px  = DEAD. Yahan kuch mat rakho.

RIGHT side ka last 140 px bhi khali rakho (like/share buttons).
```

---

## COLOURS (exact code copy karo)

| Naam | Code | Kahan use karna hai |
|---|---|---|
| Ink | `#1C1512` | Background. Warm black. **Pure black mat use karo.** |
| Ink 2 | `#251C16` | Cards, boxes |
| Paper | `#FBF2E4` | Cream. Text colour on dark background. |
| **Marigold** | `#FF7A1A` | Orange. Main highlight colour. Important words. |
| **Gulal** | `#FF3D7F` | Pink. **Ek video mein sirf 1 baar.** |
| Tulsi | `#1FAA59` | Green. Sirf tick mark ya "paisa aa raha hai" ke liye. |
| Dust | `#C9BBA8` | Light brown. Chhota text. |
| Red | `#EF4444` | Loss, problem, cross, strike |

**RULE: Orange aur Pink ek hi frame mein accent ki tarah mat use karo.** Ek time pe ek.

---

## FONTS (dono free hain, Google Fonts se download karo)

**1. Unbounded** - weight 800 ya 900
Sirf badi heading aur bade number ke liye. **Paragraph kabhi mat likho isme.**

**2. Manrope** - weight 400 se 800
Captions, chhota text, sab kuch.

---

## END CARD (ek baar banao, sab 13 video mein wahi use hoga)

Har video ke aakhir mein end card aata hai. **Ye ek baar template bana lo, fir har video mein paste karo.**

Kalim aapko 2 logo file dega:
- `logo-dark-bg.png` - dark background ke liye (zyadatar yahi use hoga)
- `logo-light-bg.png` - agar kabhi cream background pe lagana ho

**End card ka design:**
```
Background   Ink #1C1512  (warm black)
Logo         Screen ke beech mein, width lagbhag 420 px
Wordmark     "RealEstateFlow"  (Unbounded 800, Paper #FBF2E4)
             Logo ke neeche, gap 40 px
Line         Logo ke neeche ek patli orange line, #FF7A1A
             Width 120 px, height 4 px
Duration     1.5 se 2 second
Animation    Logo halka sa scale in (98% se 100%), 0.3 second. Fir bilkul still.
```

**Agar video mein CTA hai** (jaise "Comment: KHATA" ya "Comment: SYSTEM"), to:
```
CTA text     Manrope 800, 52 px
CTA pill     Orange #FF7A1A background, rounded 12 px, padding 24x16
CTA text ka colour   Ink #1C1512
Position     Wordmark ke neeche, gap 50 px
```
Aur us case mein poora end card background bhi ORANGE ho sakta hai (job card mein likha hoga "ORANGE end card").
Tab logo aur text INK colour `#1C1512` mein honge.

**Sab kuch safe zone ke andar rakhna: y 220 se 1500 px.**

---

## CAPTIONS KA STYLE (sab video mein same)

```
Font        Manrope, weight 700
Size        62 px
Colour      Paper #FBF2E4
Highlight   Har line ka 1 important word Marigold #FF7A1A mein
Line        Max 4 word per line. Max 2 line at a time.
Animation   Word by word aayega, voice ke saath. Karaoke sweep MAT karo.
Background  Text ke peeche halka dark shadow ya 60% ink pill
Position    y = 1050 se 1250
```

---

## 8 EDITING RULES (har video pe lagu)

1. **Pehle 1.5 second mein hook aana chahiye.** Fade in mat karo. Logo se start mat karo.
2. **Cut voice ke beat pe karo**, timer pe nahi.
3. **Zoom-punch karo, slow pan mat karo.** Screen recording mein specially. Beat pe zoom in, phir wapas.
4. **Kuch bhi idle hilna nahi chahiye.** Ya to move kare, ya bilkul still rahe. Floating/breathing animation = cheap lagta hai.
5. **Silence bhi ek tool hai.** Kuch script mein 2 second ka silence likha hai. **Us waqt music mat lagao.** Wo jaanbujh ke hai.
6. **Text word by word aaye**, 0.06 second gap. Block mein fade in mat karo.
7. **Loop banao.** Last frame se first frame pe clean cut jaana chahiye.
8. **Grade warm rakho.** Blacks halke uthao, thoda grain. Cold ya clinical mat karo.

---

## MUSIC

- Low, simple, halka percussion. Tabla/dholak texture chalega par **bahut halka**.
- Bollywood style music mat lagao.
- **Voice ke neeche music 12 se 15 dB kam karo.**
- Kuch video **bina music ke start hote hain**. Script mein likha hoga. Follow karo.
- Sirf royalty-free / licensed music.

---

## PRESENTER KE BAARE MEIN

Videos mein jo aadmi hai, uska naam **"Arjun"** hai. Wo **AI se banaya gaya hai**.

**Important:** Usko kabhi bhi customer, broker, ya agent mat likho. Uske neeche naam-pata (lower third) mat lagao jaise "Rajesh, Andheri Properties". Wo sirf brand ka narrator hai.

Agar kisi script mein aisa lage ki wo customer ban raha hai, **Kalim ko batao. Mat banao.**

---

## KYA MAT KARO (b-roll mein)

Ye kabhi mat use karo:
- Glass building wala corporate office
- Suit-tie wale log
- Handshake wali stock video
- Sab log camera dekh ke smile kar rahe hain
- Kuch bhi jo American lage

Ye use karo:
- Asli chhota Indian broker office, laminate desk, file ka dher
- Under-construction flat, cement, dust, exposed wiring
- Golden hour light, handheld camera, halka grain

---

## KAAM KA TARIKA

1. Aap **v1** banao, Saturday tak do
2. Kalim 24 hour mein feedback dega
3. Aap **v2** banao. Bas. Final.
4. Agar v2 ke baad bhi change chahiye, matlab brief galat tha. Kalim ko batao.

---

## TURANT KALIM KO BATAO AGAR:

- Script mein koi product feature dikhane ko bola hai par footage nahi mila
- Screen recording mein error, bug, ya khali screen dikh raha hai
- Screen recording mein kisi asli client ka naam ya phone number dikh raha hai
- Presenter ka face ya kapde pichle video se alag lag rahe hain

**Guess mat karo. Pooch lo.**
