# Credential exposure — rotation and history purge

Two files were tracked in git with live credentials. As of commit `a42f30c` both are untracked and the `.gitignore` pattern that failed to catch one of them is fixed.

**Untracking does not revoke anything.** The credentials below are still valid until you rotate them, and they remain readable in git history until the purge in Part 2 is run. Rotation is the step that actually matters — do it first, and don't let it wait on the purge.

## What was exposed

### `server/whatsapp-env.json`

Committed in 2 commits. UTF-16 encoded, which is why ordinary `grep` never surfaced it.

| Item | Type | Action |
|---|---|---|
| `GEMINI_API_KEY` | Live credential | **Rotate** |
| `BAILEY_API_KEY` | Live credential | **Rotate** |
| `BAILEY_API_ENDPOINT` | Internal ALB hostname (`dev-whatsapp-alb-*.ap-south-1.elb.amazonaws.com`) | Review exposure |
| 8 DynamoDB table names | Infra topology | No action; not secret on its own |

### `tests/playwright/.env`

Committed in 4 commits.

| Item | Type | Action |
|---|---|---|
| `TEST_TOKEN` | Real Cognito ID token | Already expired — no action |
| Cognito pool `ap-south-1_zyj8LLwrl` | Identifier | Not secret, but confirms your pool |
| Cognito client `2fd9lr0hcl8b3nuj9uimob4tf8` | Public client ID | Not secret (PKCE public client) |
| `TEST_PHONE` | A real phone number | Replace with a dedicated test number |
| `TEST_OTP=123456` | Fixed OTP, env-gated | Confirm the prod stack parameter (below) |

**On the fixed OTP — checked, and it is not a bypass by default.** It only applies when `TEST_OTP_ENABLED === 'true'` (`reality-flow-authentication/src/models/phoneLinkOtpModel.ts:48-52`, and the Cognito custom-auth trigger at `infra/cfn-backend.yaml:671`). It defaults to `false` in both `infra/deploy.sh:160` and `sample.env:46`, and is surfaced as the `TestOtpEnabled` CloudFormation parameter.

The one thing left to confirm is that the deployed production stack wasn't given `true`:

```bash
aws cloudformation describe-stacks --stack-name <prod-auth-stack> \
  --query "Stacks[0].Parameters[?ParameterKey=='TestOtpEnabled']"
```

If that returns `true`, redeploy with `false` immediately — `123456` would then log in as any registered phone number.

## Part 1 — Rotate now

### Gemini API key

1. Open Google AI Studio → **Get API key**, or Google Cloud Console → **APIs & Services → Credentials** for the project backing the key.
2. Create a new key. Restrict it to the Generative Language API.
3. Update the value everywhere it's consumed — the WhatsApp Lambda environment, and your local `server/whatsapp-env.json` (now untracked, so edit it in place).
4. **Delete the old key.** Creating a new one does not disable the old one.
5. Check billing/usage on the old key for anything you don't recognize before deleting.

### Bailey API key

1. Rotate in the Bailey/WhatsApp service admin — the endpoint is your own ALB, so this is your service to rotate against.
2. Update the Lambda environment and the local file.
3. Revoke the old key.
4. If the ALB is internet-facing, check its access logs for requests carrying the old key from unfamiliar source IPs.

### Verify nothing else leaked

```bash
git log --all --oneline -- server/whatsapp-env.json tests/playwright/.env
git ls-files | grep -iE '\.env$|env.*\.json$' | grep -vE '\.(sample|example)$'
```

The second command should return nothing. If it returns a file, untrack it the same way and add it here.

## Part 2 — History purge (coordinated, later)

Do not run this solo. `zishan chaudhary` has 34 of the last 60 commits and the repo has 20+ branches, so the rewrite has to be sequenced with whoever else is pushing.

### Preconditions

- [ ] Both keys rotated and old ones revoked (Part 1) — this must come first, so that if the purge slips or fails, the exposed values are already dead
- [ ] Every collaborator has pushed outstanding work
- [ ] Open PRs noted; expect some to need reopening after the rewrite
- [ ] Everyone told to stop pushing until you give the all-clear

### Run

```bash
# 1. Back up first — this is your undo
git bundle create ../nabi-app-backup-$(date +%Y%m%d).bundle --all

# 2. git-filter-repo is not installed; Java is absent so BFG isn't an option
pip install git-filter-repo

# 3. Strip both files from every branch and tag
git filter-repo --invert-paths \
  --path server/whatsapp-env.json \
  --path tests/playwright/.env

# 4. filter-repo drops the remote by design — re-add it
git remote add origin https://github.com/cloudberrysolutions/nabi-app-git-bkp.git

# 5. Verify BEFORE pushing: both should print nothing
git log --all --oneline -- server/whatsapp-env.json
git log --all --oneline -- tests/playwright/.env

# 6. Rewrite the remote
git push origin --force --all
git push origin --force --tags
```

### After

1. Tell every collaborator to **re-clone**. Not `pull` — a pull from an old clone reintroduces the deleted blobs on their next push, which silently undoes the whole exercise.
2. Reopen any PRs that broke.
3. On GitHub, old commit SHAs stay reachable via the API until garbage collection. If the repo is or ever was public, open a support request asking GitHub to run GC, and treat the credentials as compromised regardless — public repos are scraped within minutes of a push.

### If it goes wrong

```bash
git clone ../nabi-app-backup-YYYYMMDD.bundle recovered
```

The bundle from step 1 holds every branch and tag as they were before the rewrite.
