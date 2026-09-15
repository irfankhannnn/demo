# Phone masking and Exotel click-to-call

Contract: `followup-agent-service/docs/CONTRACTS.md` sections 2.2, 5 and 7.
Design: `followup-agent-service/docs/APPROVAL-PLAN.md` sections 3.5 and 3.6.

## 1. Phone masking

Code: `server/middleware/phoneMasking.js` (tests: `phoneMasking.test.js`).

### What is masked

Every `/api/crm/*` JSON response, for any user whose role is not `ADMIN`,
`FOUNDER` or `OWNER`. In practice the auth service only mints `ADMIN` and
`MEMBER`, so: agency owners see full numbers, team members see masked ones.

Keys (case-sensitive, at any depth, inside arrays and nested objects):

```
phone, mobile, mobileNumber, alternatePhone, normalizedPhone, contactNumber,
ownerPhone, attendeePhone, relatedEntityPhone, whatsapp, whatsappNumber,
phoneNumber, tenantPhone, buyerPhone, sellerPhone
```

Format: keep the country code when present and the last four digits.

| stored value      | masked value      |
|-------------------|-------------------|
| `+919812345678`   | `+91 ******5678`  |
| `919812345678`    | `+91 ******5678`  |
| `9812345678`      | `******5678`      |
| `09812345678`     | `******5678`      |

Every object that had at least one key masked gains `phoneMasked: true`, and
the response carries the header `X-Phone-Masked: true`. Strings with fewer
than 7 digits or containing letters (`N/A`, emails) are left as they are.
Integer values under a phone key are masked as their decimal string
(`9812345678` -> `"******5678"`); booleans, objects, null and undefined are
never touched.

Never masked: `/api/internal/*` (service-to-service), responses with no
`req.user` (public listing and API-key routes), and any path outside
`/api/crm`.

### How to mount

```js
import phoneMaskingMiddleware from './middleware/phoneMasking.js';

// Before ANY /api/crm/* router.
app.use('/api/crm', phoneMaskingMiddleware());
```

The middleware runs before the per-route `validateToken`, so `req.user` does
not exist when it executes. It only wraps `res.json`; the role check is
deferred to the moment the route calls `res.json(...)`, by which time the
route's own auth chain has set `req.user`. That is why it can be mounted once
at the top and still cover every route without editing them.

`maskPhonesDeep` is pure and returns the original reference when nothing
changed, so an unmasked response costs one walk and no allocations.

For ad-hoc use outside a response (exports, WhatsApp templates):

```js
import { maskPhonesForUser, maskPhone } from './middleware/phoneMasking.js';
const safe = maskPhonesForUser(req.user, rows);
```

## 2. Click-to-call

Code: `server/routes/clickToCall.js` (tests: `clickToCall.test.js`).

### Flow

```
Browser                    CRM (server/)                       ai-calling-service            Exotel
  |  POST /api/crm/calls/click-to-call                            |                            |
  |  { entityType, entityId }  |                                  |                            |
  |--------------------------->| validateToken -> req.user        |                            |
  |                            | callee = getLead/getBuyer/...    |                            |
  |                            |   (phone read from DynamoDB)     |                            |
  |                            | caller = req.user.phoneNumber    |                            |
  |                            | both -> E.164 (+91...)           |                            |
  |                            |  POST /calls/connect             |                            |
  |                            |  x-api-key: CRM_CALLER_API_KEY   |                            |
  |                            |  x-tenant-id: <session tenant>   |                            |
  |                            |--------------------------------->| Calls/connect.json         |
  |                            |                                  | From=caller To=callee      |
  |                            |                                  | CallerId=EXOTEL_CALLER_ID  |
  |                            |                                  |--------------------------->|
  |                            |<-- 201 { callSessionId, callSid, status: "initiated" }        |
  |                            | logContactActivity('click_to_call') (best effort)             |
  |<-- 202 { callSessionId, callSid, status }                     |                            |
```

Exotel first rings the team member's phone, then bridges the contact.

Request body: `{ entityType, entityId }` where `entityType` is one of
`lead | buyer | owner | customer | tenant | contact | property` (`tenant` is an
alias of `customer`; for `property` the owner's number is used, from
`ownerPhone` or `ownerSnapshot.phone`).

Auth chain: `validateToken -> extractTenantId -> requireCrmMemberOrAbove`
(any CRM user, members included).

Responses:

| status | body                                              | when |
|--------|---------------------------------------------------|------|
| 202    | `{ callSessionId, callSid, status }`              | call initiated |
| 400    | `{ error: 'invalid_entity' }`                     | bad `entityType` / missing `entityId` |
| 400    | `{ error: 'caller_phone_missing', message }`      | user profile has no mobile number |
| 400    | `{ error: 'caller_phone_invalid' }`               | profile number is not an Indian mobile |
| 400    | `{ error: 'callee_phone_invalid' }`               | stored contact number is unusable |
| 404    | `{ error: 'entity_not_found' }`                   | entity missing under the session tenant |
| 404    | `{ error: 'entity_phone_missing' }`               | entity has no phone |
| 503    | `{ error: 'click_to_call_not_configured' }`       | calling service URL / key unset, or the service reports `EXOTEL_CALLER_ID` blank |
| 502    | `{ error: 'calling_service_unreachable' }`        | network failure |

No response, log line or activity record ever contains either phone number.
Error strings coming back from the calling service are scrubbed of digit runs
before forwarding.

The activity log entry (when the entity resolves to a Contact) is:
`activityType: 'click_to_call'`, `subjectEntityType/Id` = the entity,
`performedBy` = user display name, `payload: { callSessionId, callSid }`.
Leads do not resolve to a Contact today (`getContactIdForEntity` returns
`null` for `LEAD`), so lead calls are logged to the application log only.

### Config needed

CRM (`server/`), already used by `routes/aiCalling.js`:

- `AI_CALLING_SERVICE_DOMAIN_NAME`, `AI_CALLING_SERVICE_BASE_PATH`
- `CRM_CALLER_API_KEY`
- `AI_CALLING_SERVICE_TIMEOUT_MS` (optional, default 10000)

ai-calling-service:

- `EXOTEL_CALLER_ID`: the ExoPhone shown to both parties. Required in prod;
  when blank the service returns 503 and the CRM surfaces
  `click_to_call_not_configured`.
- Existing Exotel SID / API key / token, and `WEBHOOK_BASE_URL` for the
  status callback.

User profile:

- The caller leg comes from `/auth/me` -> `user.phoneNumber`. Team members
  must add their mobile number in the profile before they can place calls.

### Mounting in `server/server.js`

```js
import clickToCallRoutes from './routes/clickToCall.js';

// Before app.use('/api/crm', crmRoutes) so the sub-path is never swallowed.
app.use('/api/crm/calls', clickToCallRoutes);
```

### API Gateway route entry

The `/api/{proxy+}` catch-all already forwards the route to the Lambda. To
add the explicit method in the convention of `infra/apigw-explicit-routes.yaml`,
insert the following after `CrmConfigAiEmployeeOptionsMethod` (before
`CrmAgentsResource`) and re-run `python infra/split-apigw-routes.py` to
regenerate part1/part2:

```yaml
  # ============== CRM Calls (click-to-call) ==============
  CrmCallsResource:
    Type: AWS::ApiGateway::Resource
    DependsOn: CrmOptionsMethod
    Properties:
      RestApiId: !Ref RestApiId
      ParentId: !Ref CrmResource
      PathPart: calls

  CrmCallsClickToCallResource:
    Type: AWS::ApiGateway::Resource
    DependsOn: CrmCallsResource
    Properties:
      RestApiId: !Ref RestApiId
      ParentId: !Ref CrmCallsResource
      PathPart: click-to-call

  CrmCallsClickToCallPostMethod:
    Type: AWS::ApiGateway::Method
    DependsOn: CrmCallsClickToCallResource
    Properties:
      RestApiId: !Ref RestApiId
      ResourceId: !Ref CrmCallsClickToCallResource
      HttpMethod: POST
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${LambdaFunctionArn}/invocations"
      MethodResponses:
        - StatusCode: 200
          ResponseParameters:
            method.response.header.Access-Control-Allow-Origin: true
            method.response.header.Access-Control-Allow-Headers: true
            method.response.header.Access-Control-Allow-Methods: true
        - StatusCode: 500
          ResponseParameters:
            method.response.header.Access-Control-Allow-Origin: true
            method.response.header.Access-Control-Allow-Headers: true
            method.response.header.Access-Control-Allow-Methods: true

  CrmCallsClickToCallOptionsMethod:
    Type: AWS::ApiGateway::Method
    DependsOn: CrmCallsClickToCallPostMethod
    Properties:
      RestApiId: !Ref RestApiId
      ResourceId: !Ref CrmCallsClickToCallResource
      HttpMethod: OPTIONS
      AuthorizationType: NONE
      Integration:
        Type: MOCK
        PassthroughBehavior: NEVER
        ContentHandling: CONVERT_TO_TEXT
        RequestTemplates:
          application/json: '{"statusCode": 200}'
        IntegrationResponses:
          - StatusCode: 200
            ContentHandling: CONVERT_TO_TEXT
            ResponseParameters:
              method.response.header.Access-Control-Allow-Headers: !Sub "'${AllowHeaders}'"
              method.response.header.Access-Control-Allow-Methods: !Sub "'${AllowMethods}'"
              method.response.header.Access-Control-Allow-Origin: !Sub "'${AllowOrigin}'"
      MethodResponses:
        - StatusCode: 200
          ResponseParameters:
            method.response.header.Access-Control-Allow-Headers: true
            method.response.header.Access-Control-Allow-Methods: true
            method.response.header.Access-Control-Allow-Origin: true
```

If the frontend needs to read `X-Phone-Masked`, add it to the CORS
`exposedHeaders` list; it is not required for masking to work.

## 3. Tests

```
cd server
node --test middleware/phoneMasking.test.js routes/clickToCall.test.js
```

The files also run under the repo's jest setup (`npm test` globs every
`*.test.js`): they pick node:test or jest globals at load time and use
`node:assert` for assertions.
