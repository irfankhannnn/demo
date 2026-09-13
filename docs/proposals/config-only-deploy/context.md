# Config-only deploy mode — design context

Written 2026-09-11 after a domain-migration exercise (`landing-pages`,
`real-estate-crm-app`, `reality-flow-authentication` all redeployed to point
at `realestateflow.in`/`app.realestateflow.in`) exposed how expensive a pure
config change currently is in this repo's `cfn-templates-cicd/<service>/
deploy.sh` pipelines. This doc is a design brief for whoever builds a
lighter-weight path — it is not an implementation, and no code here has been
written yet.

## The triggering observation

Changing `real-estate-crm-app`'s custom domain required:
`FRONTEND_CUSTOM_DOMAIN_NAME`, `FRONTEND_ACM_CERTIFICATE_ARN` set in
`.env.dev` (pure CFN parameters — CloudFront `Aliases`/`ViewerCertificate`,
nothing else touches them) **plus** `VITE_AUTH_REDIRECT_URI`/
`VITE_AUTH_LOGOUT_URI` changed to the new domain. The second pair is NOT a
runtime value — Vite inlines `VITE_*` vars into the built JS bundle at
compile time (`vite build --mode dev`). So this specific change could not
have skipped the build step even in an ideal config-only world. The
`reality-flow-authentication` change (Cognito `CallbackURLs`/`LogoutURLs`,
`ALLOWED_ORIGINS`) was, by contrast, a genuine pure-config change — nothing
in that Lambda's actual code differs, only its CFN-parameterized environment
— and still went through a full `npm install` + zip + upload + `cloudformation
deploy` cycle lasting several minutes.

**The real ask: for the `reality-flow-authentication`-shaped case (backend
Lambda, env/CFN-parameter-only change, code unchanged), can the pipeline skip
straight to a CFN parameter update and skip install/build/zip/upload
entirely?** And separately, can the CRM-frontend-shaped case (CFN param
change + a build-time env var change) at least skip whatever isn't strictly
required?

## Three categories of "config change" that exist in this repo today

This distinction is the crux of the design — conflating them will produce a
tool that's either unsafe (skips a required rebuild) or useless (still does
the expensive thing every time).

1. **Pure CFN parameters, no code/bundle impact.** Custom domain name, ACM
   cert ARN, hosted zone ID, WAF WebACL ARN, CloudFront price class, Lambda
   memory/timeout, DynamoDB billing mode, etc. Changing these only needs
   `aws cloudformation deploy`/`update-stack` with new `--parameter-overrides`
   — no new artifact of any kind.

2. **Backend runtime env vars, CFN-parameterized into `Environment.Variables`
   on a Lambda.** `ALLOWED_ORIGINS`, `IDENTITY_CALLBACK_URL`,
   `CRM_INTERNAL_API_URL`, feature flags like `AGENTS_ENABLED`, credit costs,
   rate limits, etc. — everything server/.env.dev, reality-flow-
   authentication/.env.dev, property-pages-ms/.env.dev, backend_insta_sol_ms/
   .env.dev carry. These are consumed via `process.env.X` at Lambda runtime,
   not baked into any artifact. **In principle** these should be exactly as
   cheap as category 1 — a CFN parameter update against the already-deployed
   code. **In practice, today's scripts always rebuild+re-zip+re-upload the
   Lambda code on every single run regardless of what changed** (see
   "The code-identity problem" below for why that happens even when nothing
   about the code differs).

3. **Frontend build-time env vars (`VITE_*`).** These are compiled into the
   static JS bundle by Vite and served as static files from S3. Changing one
   is NOT a CFN-only change — it requires `npm run build` (or at least `vite
   build`) and a re-sync of `dist/` to S3, even though no source *code*
   changed and no CFN template/parameter changed either. This is a distinct
   third case from both of the above: no CFN update needed, but a rebuild and
   re-upload is unavoidable. (If the CFN parameters also changed at the same
   time — as happened with the CRM app's custom domain — you need both.)

Category 3 can never be made "config-only" in the sense of skipping a build;
the best available optimization there is skipping the CFN stack update step
when only a `VITE_*` value changed and no CFN parameter (custom domain, cert,
price class, WAF) did.

## The code-identity problem (why category 2 isn't already free)

Every `deploy.sh` in this repo uploads a **freshly timestamped** Lambda zip
key on every run — e.g. `server`'s deploy uploads to
`s3://dev-realestateflow-artifacts/dev-realestateflow/function-20260910135555.zip`,
a new key every time, then passes that key into `cfn-params.json` as the
Lambda's `S3Key` parameter. CloudFormation's change detection for
`AWS::Lambda::Function` is based on the literal `Code.S3Key` (or
`S3ObjectVersion`) string in the template/parameters — **it does not diff zip
contents**. So even a run where the actual code is byte-identical to what's
live today still looks like a code change to CloudFormation, because the key
string itself changed, and the full install/build/zip/upload sequence
happens to produce that new key in the first place.

A config-only mode therefore needs to explicitly **pin the code-location
parameter(s) to whatever the currently-deployed build already used**, rather
than generating a new one. Concretely: read the last deployed build's
`S3Key`/`S3ObjectVersion` out of that build's recorded `manifest.json` (every
wrapper already writes one to `cfn-templates-cicd/<service>/deploy-versions/
<build>/manifest.json`) and feed that exact value back into the parameter
set — or use CloudFormation's own `UsePreviousValue: true` parameter flag for
just that key, which is the mechanism AWS built for precisely this ("leave
this parameter as whatever the stack already has, don't touch it").

**Nuance for hybrid changes:** if a change touches *both* an env var (say,
`AGENT_ACTION_CREDITS`) *and* something that requires a real code change,
config-only mode must not be used — that's still a full build/deploy. The
tool needs some way to know which category a change falls into; the simplest
version of that is a human/agent choosing the right pipeline command
deliberately (`deploy.sh dev` vs `deploy.sh dev --config-only`), with the
config-only path failing loudly if it detects the code artifact would
actually need to differ (there's no fully automatic way to detect this
without diffing source against the last deployed commit, which is a
reasonable enhancement but not required for a first version).

## What "regenerate cfn-params.json" currently does, and why it's a problem for this

Today, every deploy run regenerates `infra/cfn-params.json` **from scratch**
from the current `.env.$env` file, covering every parameter the template
declares — code-location params included. A config-only mode can't just
reuse this generation path unmodified, because it would blow away the "leave
the code-location alone" property the whole point rests on. The config-only
path needs to generate a params set that mixes "changed, take the new value"
(the domain/cert/env-var keys that actually changed) with "unchanged, keep
whatever's live" (code-location keys, and arguably every other key that
*isn't* part of this particular change) — which is exactly what CFN's
`UsePreviousValue` is for, called per-parameter rather than regenerating the
full set positionally every time.

## Versioning: a separate track, not reusing the build counter

The existing `deploy-versions/0001, 0002, ...` counter (global across `dev`
and `prod`, per the checklist this repo already enforces) represents a full
application-code build. The user's instinct to keep config revisions on a
**separate** numbering track is right — conflating "build #27" with "config
revision #4 applied on top of build #27" loses exactly the information you'd
need to answer "what is actually running right now" during an incident. Two
independent tracks need to be reconstructable at any point in time:

- **Which code build is live** (existing mechanism, unchanged).
- **Which config revision is currently applied on top of it** (new).

Suggested shape for the new track, mirroring the existing `manifest.json`
pattern per the request for "dates, commit id, version":

```
cfn-templates-cicd/<service>/config-versions/<NNNN>/manifest.json
```
```jsonc
{
  "configVersion": 4,
  "appliedToBuild": 27,          // the build this config revision sits on top of
  "env": "dev",
  "deployedAt": "2026-09-11T09:14:00+05:30",
  "deployer": "Kalim Qureshi",
  "commitId": "9d7b1bc",          // HEAD at deploy time; dirty flag same as today
  "dirty": true,
  "changedParams": {              // the actual diff — critical for audit/rollback
    "CustomDomainName": { "from": "", "to": "app.realestateflow.in" },
    "AcmCertificateArn": { "from": "", "to": "arn:aws:acm:us-east-1:...:certificate/bedaa7cd-..." }
  }
}
```

The `changedParams` diff matters more here than it does for a full build's
manifest, precisely because a config revision's *entire content* is that
diff — there's no zip/dist archive alongside it to fall back on for "what did
this actually change."

Rollback follows the existing `rollback-code`/`rollback-full` pattern this
repo already has (both guarded by `verify_build_env` per the CI/CD
checklist) — add a third command, e.g. `rollback-config <N>`, that
re-applies a prior config-manifest's parameter snapshot via
`cloudformation deploy`, still pinning the code-location parameter to
whatever build is currently live (not necessarily the build that was live
when that old config revision was first applied — that's a judgment call for
the design: should `rollback-config` also imply "and roll the code back to
whatever build it was paired with," or always assume "reapply this parameter
set to whatever code is running now"? Recommend the latter as the default,
since config and code rollback are usually independent concerns, with the
former available as an explicit opt-in flag if ever needed).

## Reuse the existing pipeline, or build separate?

Recommend **extending** the existing per-service `deploy.sh` wrappers with a
`config-only` mode/flag rather than standing up a parallel pipeline. Reasons:

- All the scaffolding a config-only path needs already exists per service:
  env-file loading, `STACK_NAME` construction, the `cfn-readiness-auditor`
  gate, S3 artifact bucket wiring, build-tracking conventions. Duplicating
  this into a second pipeline means every future change to deploy safety (like
  the env-first naming/`verify_build_env` conventions this repo already
  enforces) has to be made twice and can drift.
- The failure mode to guard against isn't "one script is more complex than
  two," it's "a config-only path that quietly does the wrong thing because it
  doesn't share the existing safety checks" — reuse gets you the checklist
  compliance (naming, secrets hygiene, env-file validation) for free.
- A separate `config-versions/` directory (not `deploy-versions/`) inside the
  same wrapper already gives the "separate version number" the user asked
  for, without needing a separate pipeline to produce it.

## Open questions for the design agent to resolve

1. Should the `cfn-readiness-auditor` gate run before a config-only deploy
   too, or a lighter subset of its checklist (most of the checklist — secrets
   hygiene, naming convention, deploy-script safety — is unaffected by a
   config-only change; only the "no CFN circular dependency" and "domain
   param matches env" items are actually relevant to re-check)?
2. How does config-only mode detect "this parameter change actually requires
   a code/bundle rebuild" so it can refuse instead of silently producing a
   broken deploy? A per-service denylist of "these keys require full
   deploy" (e.g. every `VITE_*` key, `LAMBDA_RUNTIME`) is the simplest
   starting point; something structural (tagging keys in each `.env.*.sample`
   file with a comment marker) is a possible cleaner follow-up.
3. For the frontend static-site services specifically (`landing-pages`,
   `real-estate-crm-app`, `frontend_insta_sol_ms`), is a "config-only" mode
   (CFN-params-only, no rebuild) worth having as a distinct thing from a
   "rebuild-only, no CFN touch" mode (a `VITE_*`-only change)? Today's
   observation suggests both cases are real and distinct, not one axis.
4. Is this actually recurring friction, or a one-time migration cost now
   already paid? Domain/cert wiring (today's trigger) is typically a
   bootstrap event per service, not a routine change. Backend env-var/flag
   changes (credit costs, rate limits, feature flags) are the more plausible
   recurring case worth optimizing for — worth confirming that's really the
   target before building machinery for the rarer domain-wiring case.

## What NOT to change while building this

Everything this repo's CFN readiness checklist already enforces (env-first
naming, per-env artifact bucket, S3 build tagging, `verify_build_env` guards,
secrets hygiene) applies equally to a config-only path — it is a new *mode*
of the existing pipeline, not an exemption from any of its existing safety
rules.
