# Follow-up agent: deploy order and dashboard steps (dev)

Nothing here has been run yet. Deploy only after the approval plan is signed off.

## 0. Generate the shared secrets (once per environment)

```bash
openssl rand -hex 32   # FOLLOWUP_CALLER_API_KEY  (CRM -> followup)
openssl rand -hex 32   # FOLLOWUP_INTERNAL_API_KEY (followup -> CRM)
```
`AI_CALLING_CALLER_API_KEY` is the existing `CRM_CALLER_API_KEY` from `agency-app/ai-calling/.env.dev`.

## 1. ai-calling-service (extended)

1. `agency-app/ai-calling/.env.dev`: add `EXOTEL_CALLER_ID=<ExoPhone in E.164>` (blank keeps click-to-call disabled).
2. `cd ai-calling-service && npm run deploy:dev` (adds `events:PutEvents`, the new tools, `call.ended` events, `/calls/connect`).
3. ElevenLabs dashboard, on the shared agent:
   - Replace the system prompt with `elevenlabs-agent-prompt.md` (new sections for `site_visit_confirmation` and `post_visit_feedback`).
   - Add the three tools from `elevenlabs-agent-tools.md`: `confirm_site_visit`, `record_visit_feedback`, `request_callback` (same headers as the existing tools).
   - Post-call webhook is unchanged.

## 2. followup-agent-service (new)

1. `cp .env.example .env.dev` and fill: `CRM_INTERNAL_API_DOMAIN_NAME=services-api.cloudberrysolutions.in`, `CRM_INTERNAL_API_BASE_PATH=devrealestatecrm`, `AI_CALLING_SERVICE_DOMAIN_NAME=services-api.cloudberrysolutions.in`, `AI_CALLING_SERVICE_BASE_PATH=devrealestateagencyai`, `FOLLOWUP_API_DOMAIN_NAME=services-api.cloudberrysolutions.in`, `FOLLOWUP_API_BASE_PATH=devrealestatefollowup`, the three secrets, optional `ALERTS_TOPIC_ARN`.
2. `npm run deploy:dev` (runs the tests first, then the CI/CD wrapper records build 0001).
3. Note the `FollowupApiBaseUrl` output.

## 3. CRM server

1. `agency-app/api/.env.dev`: `FOLLOWUP_SERVICE_DOMAIN_NAME=services-api.cloudberrysolutions.in`, `FOLLOWUP_SERVICE_BASE_PATH=devrealestatefollowup`, `FOLLOWUP_CALLER_API_KEY`, `FOLLOWUP_INTERNAL_API_KEY` (values from step 0).
2. Deploy the server through `infra/cicd/agency-app/api/deploy.sh dev` (SSM sync picks up the four new keys; API Gateway gets the new routes).
3. Per tenant: `PATCH /api/crm/config/ai-employee` with `followupCallsEnabled: true` (and optionally `followupCallOnNewInstagramLead`, `followupEscalationUserIds`). `aiEmployeeEnabled` must already be true.

## 4. Frontend

Deploy `real-estate-crm-app` as usual. Members now see masked numbers and a Call button; the lead page shows the AI follow-up timeline.

## 5. Instagram Excel pipeline

`tools/kalim-sessions/kalim-automations/hp-insta-lead-automation/config/crm-push.json` with the dev CRM base URL, tenant id and `ADAPTER_INTERNAL_API_KEY`; run `python scripts/push_leads_to_crm.py --dry-run` first.

## Smoke test

1. Create a lead with a real test phone, then `POST /api/crm/leads/:id/followup-call`.
2. Within 5 minutes the worker places the call (CloudWatch `/aws/lambda/dev-realestateflow-followup-worker-lambda`: `CALL_PLACED`; if not, the `dispatch result` line says why). Do not answer.
3. Expect `JOB_RETRY_SCHEDULED` (45 min) then, after the second miss, `JOB_ESCALATED` and a notification to the assignee/admin.
4. Answer the second call, ask for a human: expect `JOB_NEEDS_HUMAN` and an escalation with reason `callback_requested`.
5. Mark a meeting whose title contains "Site visit" (or has `meetingType: site_visit`) completed: expect a `post_visit_feedback` job due ~2 h later.

## Rollback

`infra/cicd/agency-app/followup-agent/deploy.sh rollback-full dev <build>`. Disabling calls without a deploy: set `followupCallsEnabled: false` on the tenant, or disable the `<env>-realestateflow-followup-dispatch` EventBridge rule.
