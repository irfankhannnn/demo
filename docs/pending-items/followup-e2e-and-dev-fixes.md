# Follow-up calling E2E and dev bug fixes — open items (2026-09-16)

Context for anyone picking this up. This work was done on
`claude/followup-agent-service-test-1eb622` and merged into
`feat/property-pages-ms`; that branch has been deleted. Branch-wide and
deploy-collision items are in [deploys-and-branches.md](deploys-and-branches.md).
The test script is `docs/services/followup-agent-service/E2E-TEST-BRIEF.md`.

## What was fixed (now in `feat/property-pages-ms`)

| Area | Fix |
|---|---|
| CRM frontend | NPS popup no longer shows on `/login`, `/signup`, onboarding and other public pages. It only shows to a signed-in user whose account is at least 14 days old; the old check read the wrong localStorage key. |
| CRM frontend | The dashboard says "Welcome back, &lt;name&gt;" and the profile header shows the user's name, where both used to say "Admin". |
| CRM frontend | Google sign-in sends `prompt=select_account`, so you can pick a different Google account. **This only takes effect once Cognito is on managed login v2 (see below).** |
| Auth service | `infra/cfn-backend.yaml` switches the v2 domain to `ManagedLoginVersion: 2` and adds a `ManagedLoginBranding` for the v2 client. The `/auth/google` route also sends `prompt=select_account`. **Not deployed.** |
| CRM server | `deploy.sh` no longer deletes SSM keys before the new code is live. New keys are written first, and stale keys are pruned only after the stack update succeeds. `sync-ssm-params.sh` gained `--no-delete`, `--delete-only` and `--dry-run`. |
| CRM server | `jest.setup.js` sets placeholder table names and region, so the suite runs locally: 66 suites and 952 tests pass. |
| ai-calling, followup | `deploy.sh` uses `grep -c >/dev/null` instead of `grep -q`, which broke under `pipefail`. The followup `.env.example` quotes `rate(5 minutes)`, so the env file can be sourced. |

## Action items

### 1. Redeploy the CRM frontend to dev (owner: whoever deploys next)

- [ ] Deploy from `feat/property-pages-ms`. Build 0002, deployed 2026-09-15 21:03 UTC, had these fixes, but the 21:10 and 21:43 deploys from other checkouts replaced it. On 2026-09-16 the live bundle still said "Welcome back, Admin" and had no `select_account`.
- [ ] Before deploying, set the build number past the newest one in S3 (`0011` at the time of writing) so an older archive isn't overwritten. See "Build numbers collide" in deploys-and-branches.md.
- [ ] After deploying, check the live bundle: it should contain `select_account` and should not contain "Welcome back, Admin".

### 2. Cognito managed login v2 (needs your approval; changes the shared dev user pool)

The account picker only appears once this is done. Pick one of these routes:

- [ ] Deploy `reality-flow-authentication` to dev (the template change above), **or** run:
  ```bash
  aws cognito-idp update-user-pool-domain --profile cloudberry-main --region ap-south-1 --user-pool-id ap-south-1_URMcnVFE9 --domain dev-realestateflow-auth-v2 --managed-login-version 2
  aws cognito-idp create-managed-login-branding --profile cloudberry-main --region ap-south-1 --user-pool-id ap-south-1_URMcnVFE9 --client-id 3a18v9qkrh6si8tcmmr67dvkfc --use-cognito-provided-values
  ```
  To roll back, run the first command with `--managed-login-version 1`.
- [ ] Check it: `describe-user-pool-domain` shows `ManagedLoginVersion: 2`, and "Continue with Google" shows the account chooser.
- [ ] If the CLI route was used, deploy the auth stack later anyway so CloudFormation matches.

### 3. Values needed before AI calls work (owner: you)

| Value | Where it goes | Where to get it |
|---|---|---|
| `EXOTEL_CALLER_ID` = `02246180704` | `services/ai-calling-service/.env.dev` | Already found; this is the account's ExoPhone. |
| `ELEVENLABS_AGENT_PHONE_NUMBER_ID` (`phnum_…`) | `services/ai-calling-service/.env.dev` | ElevenLabs → Agents → Phone numbers → Import number → SIP trunk / Exotel. Label it `RealEstateFlow Dev ExoPhone`, number `+91 2246180704`, and enter your own Exotel SID, API key and token. Copy the ID it creates. |
| Exotel outbound calling enabled | Exotel dashboard | Confirm the Connect API / outbound calling is active on the account. |

- [ ] After both env values are filled in: `infra/cicd/ai-calling-service/deploy.sh config-deploy dev`.

### 4. ElevenLabs dev agent setup (needs your "yes"; changes the agent)

The dev agent `[Dev] RealEstateFlow AI` (`agent_9701m1fm8dbme9cv9jya6nqc5tdw`) has no tools and no post-call webhook.

- [ ] Create the 9 server tools listed in `services/ai-calling-service/elevenlabs-agent-tools.md`. Headers bind to `secret__` dynamic variables, and there is no `tenant_id` body parameter.
- [ ] Add the post-call webhook. If its secret differs from `ELEVENLABS_WEBHOOK_SECRET` in `.env.dev`, update the env value and run config-deploy again.
- [ ] If a call fails with "Agent configuration missing", seed an agent-config row for the test tenant.

### 5. Run the E2E (after 1–4)

- [ ] Log out, then confirm there is no NPS popup on `/login`.
- [ ] Continue with Google and pick the **new** Google account (it becomes the ADMIN). Go through `/onboarding/role-selection` → register-admin → choose-plan, entering the phone number during onboarding.
- [ ] Follow `E2E-TEST-BRIEF.md` §2–4: invite your existing Gmail account as MEMBER, then run the AI follow-up call flow.

### 6. Known gaps, not fixed

- [ ] The CRM server wrapper's `rollback-code` / `rollback-full` restore code and stack but not SSM keys, so a rollback after a key rename can leave the old code without the keys it reads.
- [ ] `reality-flow-authentication` has no `.env.dev`, so the `/auth/google` change there can't go through the wrapper until one is created.
- [ ] `real-estate-crm-app` still has 75 existing `tsc` errors in untouched files. `vite build` ignores them, but `tsc --noEmit` doesn't pass.
- [ ] Running `apps/crm/server/infra/deploy.sh` does `npm ci --omit=dev`, which removes jest. Run `npm ci` in `apps/crm/server/` before running tests again.
