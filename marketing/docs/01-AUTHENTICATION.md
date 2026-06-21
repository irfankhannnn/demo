# Authentication Guide — MCPs Setup

Connect all three MCPs before using the marketing system.

---

## 1. Higgsfield MCP (AI Image + Video Generation)

**What it unlocks:** Nano Banana Pro (images), Veo 3.1, Kling 3.0, Sora 2 (videos), FLUX, GPT Image 2

### Step 1: Add the MCP (already done if `.mcp.json` exists)
```bash
! claude mcp add --transport http --scope project higgsfield https://mcp.higgsfield.ai/mcp
```

### Step 2: Authenticate
```bash
! claude mcp list
```
Claude Code will open a browser → sign in to your Higgsfield account → authorize.

### Step 3: Verify
In Claude Code chat:
```
"List available Higgsfield models"
```
You should see: Nano Banana Pro, Veo 3.1, Kling 3.0, Sora 2, FLUX, Soul 2.0, etc.

### Credits
- Images (Nano Banana Pro): ~$0.02-0.05 per image
- Videos (Veo/Kling): ~$0.20-2.00 per video depending on length
- Check remaining credits: Ask Claude "What's my Higgsfield credit balance?"

---

## 2. Meta Ads MCP (Facebook + Instagram Ads)

**What it unlocks:** 29 tools to create campaigns, ad sets, ads, audiences, CAPI setup, and pull analytics

### Step 1: Add the MCP (already done if `.mcp.json` exists)
```bash
! claude mcp add --transport http --scope project meta-ads https://mcp.facebook.com/ads
```

### Step 2: Authenticate
```bash
! claude mcp list
```
Browser opens → sign in to Facebook Business account → grant ads permissions.

**Required Facebook permissions:**
- `ads_management`
- `ads_read`
- `business_management`
- `pages_read_engagement` (for page posts)

### Step 3: Get your Ad Account ID
```
"List my Facebook ad accounts"
```
Note your Ad Account ID (format: `act_XXXXXXXXXX`) — you'll use it for every campaign.

### Step 4: Get your Facebook Page ID
```
"List my Facebook pages"
```
Note your Page ID for RealtyFlow's FB page.

### Store these for reuse
Create `marketing/campaigns/.meta-config.md`:
```
Ad Account ID: act_XXXXXXXXXX
Facebook Page ID: XXXXXXXXXX
Instagram Account ID: XXXXXXXXXX
Pixel ID: XXXXXXXXXX
```

---

## 3. Social Media Publishing (Manual Upload — no MCP)

**How publishing works:** there is **no scheduling MCP** configured. Generate the asset (Higgsfield) + caption (skills), download the file, and upload it yourself:

- **Instagram + Facebook:** [Meta Business Suite](https://business.facebook.com) → Planner → Create Post → schedule at the peak window. (Native IG/FB apps also work.)
- **YouTube Shorts:** YouTube Studio → Create → Upload → schedule.
- **LinkedIn:** LinkedIn native scheduler (clock icon under the post box) or the app.

> Meta Business Suite is **free** and is the recommended scheduler for IG + FB. See `04-SOCIAL-PUBLISHING.md` for the full manual workflow.

---

## Check All MCPs At Once

```bash
! claude mcp list
```

Expected output:
```
higgsfield    ✓ connected
meta-ads      ✓ connected
```

If any show "disconnected" or "auth required", re-run the auth steps above.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Higgsfield "401 Unauthorized" | Re-run `claude mcp list` to trigger re-auth |
| Meta Ads "No ad accounts found" | Ensure you're signed in to correct FB Business account |
| MCP not appearing in Claude | Restart Claude Code after adding MCPs |
