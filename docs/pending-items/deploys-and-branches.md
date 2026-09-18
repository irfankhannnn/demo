# Deploys and branches — open items (2026-09-16)

## Branches

The Instagram work was done on `claude/instagram-lead-automation-setup-655d4b`,
which merged `origin/feat/property-pages-ms` (two import-line conflicts, both
sides kept) and was then merged into **`feat/property-pages-ms`**. On
2026-09-16 that branch was pushed to GitHub, including the three follow-up
calling commits that had only been local (`1a09e07`, `14a002b`, `6de74b8`).
The Instagram branch is deleted; it was never pushed, so there is no remote
copy to remove.

- [x] Push `feat/property-pages-ms`.
- [ ] **Open the PR from `feat/property-pages-ms` to `main`.** `main` is behind
  both lines of work. Run the CRM server's jest suite first (it was not run
  on the merged tree; only `node --check` and the 125 Instagram tests were).
- [ ] Deploy the CRM frontend only from `feat/property-pages-ms` or `main` from
  now on, never from a feature branch that lacks the other's commits.
- [ ] Old Instagram branches still on GitHub, superseded by the hosted service:
  `cursor/instagram-local-ops-fd8d` and `feature/instagram-lead-temperature`.
  Check nothing in them is still wanted, then delete them.

## Dev deploys are being done from several checkouts at once

On 2026-09-15 the CRM frontend was deployed to dev four times from three
different checkouts, and each one replaces the whole site:

| Time (UTC) | Build | From |
|---|---|---|
| 15:50 | 0001 | `feat/property-pages-ms` @ 6de74b8 |
| 21:03 | 0002 | `claude/followup-agent-service-test-1eb622` @ 6de74b8 |
| 21:10 | 0011 | `feat/property-pages-ms` @ b579fa4 |
| 21:43 | 0001 | `claude/instagram-lead-automation-setup-655d4b` @ 737e124 |

Consequences to be aware of:

- [ ] **Follow-up calling is not on dev.** Its CRM changes (click-to-call, phone
  masking, `followupApi.ts`, `phoneMasking.ts`) were live at 21:03 and were
  replaced by the 21:10 deploy, which predates them. They are in
  `feat/property-pages-ms` now, so the next CRM deploy from that branch brings
  them back. Redeploy when whoever owns that work is ready.
- [ ] **Build numbers collide.** Each checkout counts its own builds from a
  local, gitignored `deploy-versions/`, so two different builds were both called
  0001 and the second overwrote the first's S3 archive (S3 versioning still has
  the old object). A task is queued to take the next number from the artifact
  bucket instead. Until then, **before any deploy** check the newest object under
  `s3://dev-realestateflow-artifacts/<service>/builds/` and read its `Branch`
  and `CommitId` tags to see what is actually live.
- [ ] Relabel the duplicate 0001 archive, or accept it and move on.

## Other pending items

- [ ] **Dev data wipe.** `wipe-dev-data.sh` (session scratchpad) was written for
  you to run yourself; it permanently deletes dev CRM data. It would now also
  delete the Instagram connection and everything synced, so reconnect
  @happyproperties99 afterwards. Nobody has run it.
- [ ] **Prod for the Instagram service.** Not deployed; the existing
  `prod-realestateflow-insta-*` stacks are the old device-pairing build and the
  `.env.prod` secrets are blank. Do this after App Review (see
  [instagram-app-review-actions.md](instagram-app-review-actions.md)).
- [ ] **Line endings.** `agency-app/web/package-lock.json` and
  `android/gradlew.bat` show as modified in every checkout because of CRLF vs
  LF only. A `.gitattributes` entry would stop the noise.

## How to deploy (unchanged)

Every service goes through the readiness audit and its wrapper:
`infra/cicd/<service>/deploy.sh dev`. Config-only changes, such as
`INSTA_DRY_RUN_SENDS`, use `deploy.sh config-deploy dev`. Prod deploys need
explicit sign-off.
