# Centralized Logging – Test Checklist (CloudWatch)

This checklist helps you validate the new centralized logging and quickly locate the *real* failure causing endpoint errors.

## 1) Deploy

Deploy backend as usual:

```powershell
cd server
.\deploy-lambda.ps1
```

## 2) Verify request correlation is working

Call any endpoint (example):

```bash
curl -i https://<your-domain>/<basePath>/api/health
```

In CloudWatch logs you should see:

- `request.start` with fields:
  - `requestId`
  - `method`
  - `path`
  - `tenantId` (if present)

- `request.end` with fields:
  - `statusCode`
  - `durationMs`

Also verify the response contains:
- `x-request-id` header

## 3) Verify OPTIONS is handled and correlated

```bash
curl -i -X OPTIONS https://<your-domain>/<basePath>/api/health \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

Expected:
- HTTP 200
- `Access-Control-Allow-Origin` etc.
- Lambda log should show a normal invocation (no Express error). The request id should still be present.

## 4) Verify AWS SDK calls are visible (key part)

Trigger a route that uses DynamoDB/S3, e.g.

- Login:
```bash
curl -i -X POST https://<crm-domain>/<basePath>/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <tenant>" \
  -d '{"username":"admin","password":"admin123"}'
```

Then check CloudWatch logs for entries like:

- `aws.send` with fields:
  - `client`: `DynamoDB` or `S3` or `STS`
  - `command`: e.g. `GetCommand`, `QueryCommand`, `PutObjectCommand`
  - `durationMs`
  - If it fails:
    - `errorMessage`
    - `errorName`
    - `stack`

This is the fastest way to see **which AWS call is failing**.

## 5) Common failure signatures to look for

- `ResourceNotFoundException`:
  - Wrong DynamoDB table name / region

- `AccessDeniedException`:
  - IAM role missing permission for table/index/S3 path

- `ValidationException`:
  - Bad key schema or bad query/index name

- `NetworkingError` / `TimeoutError`:
  - VPC/NAT issues (if Lambda is in a VPC)

## 6) If endpoints still fail but logs are “quiet”

If you see `request.start` + `request.end` but no `aws.send`:
- The failure is likely in routing/middleware (auth/tenant extraction) before hitting services.

If you see `request.start` then `request.error`:
- Expand the `stack` field to locate the exact file + line.

## 7) Optional: Increase verbosity

Set:

```env
LOG_LEVEL=debug
```

Redeploy. This will log more internal traces.

---

## What I need from you if it still fails

Paste **one full request flow** from CloudWatch:
- `request.start`
- any `aws.send` entries
- `request.error` (if present)
- `request.end`

Include the shared `requestId` so I can correlate everything.
