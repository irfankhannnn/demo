# Property search API

A small, standalone, read-only API that lets the Instagram Lead Desk app search
live CRM inventory without holding CRM credentials.

## Why it exists

`scripts/property_search.py` can already reach the CRM three ways, and all three
are awkward for a desktop app:

| Path | What it needs | Problem |
|---|---|---|
| internal (semantic) | `AI_CALLING_INTERNAL_API_KEY` + tenant id | that key is a backend service secret; it should not live on a laptop |
| crm (filters) | a Cognito ID token | expires in about an hour, so the app dies mid-session |
| public (list) | a tenant api key | provisioned by hand, and it returns the unranked list |

This stack is one Lambda behind a Function URL, guarded by a static `x-api-key`,
scoped at deploy time to exactly one tenant. The app gets ranked, live results
from one key that does not expire.

It is read-only by construction: the IAM role has `GetItem`, `Query`, `Scan` and
`SearchVectors` and nothing that writes. Even a compromised key cannot change
CRM data.

## What it serves

All three routes require `x-api-key`, and answer `401` without it.

```
POST /properties/search
     {"query": "1 bhk rent in Byculla under 50k",
      "limit": 8,
      "filters": {"locality": "Byculla", "bhk": "1", "dealType": "rent",
                  "minPrice": 35000, "maxPrice": 65000}}
  -> {"properties": [...], "source": "vector" | "keyword", "pool": 142}

GET  /properties/{id}      -> {"property": {...}}   (id or publicSlug)
GET  /health               -> {"ok": true, "table": "...", "vectorIndex": "...", "pool": 142}
```

Ranking, in order of what is available:

1. **DynamoDB vector index** when `VectorIndexName` is set. The query is embedded
   with Bedrock Titan and searched server-side. The index scores by cosine
   *distance*, so lower is better there; the handler flips it to a similarity so
   `_score` reads the same on every path.
2. **Embedding compared in the Lambda**, when there is no index but the rows
   carry a `descriptionVector`. Same embedding, cosine computed locally.
3. **Keyword scoring** on locality, society, title, city, type and description,
   when no row has a vector at all. Less good, still useful, and it means a
   tenant whose embeddings were never backfilled still gets answers.

Locality, bedrooms, deal type and budget are applied after the search in every
case, because the vector index only takes `propertyType` as an inline filter.

## What it reads, and what is not confirmed

Confirmed against the backend source:

- Table `<env>-realestateflow-crm`, keys `PK` / `SK`. A property is
  `PK = TENANT#<tenantId>#PROPERTY#<propertyId>`, `SK = PROFILE`,
  `EntityType = PROPERTY`
  (`agency-app/api/crmDynamodbService.js`, `createProperty`).
- Locality is stored as **`area`**, not `locality`. Display name is **`title`**,
  there is no `name`. The slug attribute is **`publicSlug`**, not `slug`.
- Pricing is written nested *and* mirrored flat: `rentalInfo.expectedRent` plus
  `rentAmount`, and `saleInfo.listedPrice` plus `price`. Note `listedPrice`, not
  `expectedPrice`. The vector index projects only the flat pair, so a row can
  arrive either way and the handler reads both.
- `descriptionVector` is a list of 1024 numbers on the property item itself,
  written by `services/embeddings/embeddingService.js` with
  `amazon.titan-embed-text-v2:0` at `normalize: true`.
- `property-vector-index` is a DynamoDB vector index, not a GSI, created
  out-of-band by `agency-app/api/infra/create-vector-index.sh` because
  CloudFormation has no property for it. So this template cannot create it
  either: if it does not exist in your environment, leave `VectorIndexName`
  blank and the Lambda does the comparison itself.
- `search-index` (GSI3, `GSI3PK = TENANT#<t>#SEARCH`) is the cheap way to list
  one tenant's properties. The Lambda queries it and falls back to a filtered
  Scan, which is what the CRM's own `getProperties` does.

Not confirmed, so written defensively:

- **The exact `SearchVectors` response field for the item.** The backend reads
  `entry.Item || entry`, and this handler does the same, then unmarshals
  shallowly. If a future SDK renames it, the vector path degrades to the
  in-Lambda comparison rather than failing.
- **Attribute spellings across older rows.** Anything written before the current
  `createProperty` may use different names, so every read goes through a `dig()`
  helper that tries several spellings, exactly like
  `property_search.normalise_property` does on the python side.
- **Whether `descriptionVector` is backfilled for your tenant.** `GET /health`
  reports `pool`; if search keeps answering `"source": "keyword"`, the vectors
  are missing and `agency-app/api/scripts/backfill-property-embeddings.js` is
  what fills them.
- **Bedrock model access.** `amazon.titan-embed-text-v2:0` has to be enabled in
  the account and region. Without it the embedding call fails and the handler
  falls through to keyword scoring.

## Deploying

Needs an existing S3 bucket in the same account and region for the zip, the
tenant id this API may read, and a long random api key.

```powershell
cd infra
./deploy.ps1 -ArtefactBucket <your-deploy-bucket> `
             -TenantId <tenant-uuid> `
             -ApiKey <long-random-string> `
             -Env dev -Region ap-south-1 `
             -VectorIndexName property-vector-index
```

`-DryRun` builds and zips but sends nothing to AWS: it prints every `aws`
command it would have run. Use it first.

Other switches: `-PropertiesTableName` (defaults to `<env>-realestateflow-crm`),
`-EmbeddingModelId`, `-AllowedOrigins`, `-StackName`, `-AwsProfile`.

The zip key carries a content hash, so CloudFormation always notices new code.
Reusing one key is the usual reason a Lambda deploy silently ships the old
bundle.

## Pointing the app at it

`deploy.ps1` prints the two lines. Paste them into `.env` beside the README:

```
PROPERTY_API_BASE=https://xxxxxxxx.lambda-url.ap-south-1.on.aws
PROPERTY_API_KEY=<the same key you deployed with>
```

`scripts/property_api.py` picks them up on the next start and puts this API in
front of the CRM paths. Check it with:

```
curl -H "x-api-key: <key>" https://xxxxxxxx.lambda-url.ap-south-1.on.aws/health
```

### CORS

Lambda Function URL CORS takes exact origins only, there is no `http://localhost:*`
wildcard. The default allow-list is the desk app's own port (`8931`); if you
changed `PORT` in `.env`, pass `-AllowedOrigins`. The handler also echoes any
loopback origin back in its own headers, which covers browsers reaching it
directly from a different local port.

## When it is not deployed

Nothing breaks. `property_api.search()` tries this API first only when
`PROPERTY_API_BASE` is set, and on any failure it notes what went wrong and falls
through to `property_search.match_properties`, which tries the CRM paths and then
`config/mock-properties.json`. With no `.env` at all the app runs entirely off the
mock inventory. The status strip shows which path answered, so a silent fallback
is never invisible.

One deliberate exception: an *empty* result from a live CRM stays empty. "We have
nothing in Byculla" is a true answer, and quietly showing mock flats instead would
put invented inventory in front of a real lead.

## Rough cost

For one agency doing a few hundred searches a day, this rounds to a couple of
dollars a month:

- Lambda: 512 MB arm64, ~1-3s per request. A thousand requests a month is well
  inside the free tier; without it, cents.
- DynamoDB: on-demand reads. The keyword path reads the tenant's property rows
  (capped at `MAX_POOL_SIZE`, default 1000) per search, so a few hundred RCU per
  call. The vector path reads only `TopK`, so it is far cheaper, and is the
  reason to create the index once inventory grows past a few hundred listings.
- Bedrock Titan v2 embeddings: roughly $0.02 per million input tokens, and a
  query is a dozen tokens. Effectively free at this volume.
- CloudWatch Logs: 14-day retention by default.

The thing that would actually cost money is pointing this at a table with tens of
thousands of rows and leaving it on the keyword path. Create the vector index
before that happens.

## Security notes

- The api key is the only auth. It sits in the Lambda's environment and in your
  local `.env`, both of which are outside git. Rotate it by redeploying with a
  new `-ApiKey`.
- The tenant id is baked into the stack, not taken per request, so a leaked key
  cannot be pointed at another agency's inventory.
- The role cannot write, and cannot read any table other than the one named.
- Owner name and phone live on the property row and are returned as-is. This
  endpoint is for the agency's own desk app; do not hand the key to a client.
