# CRM E2E Tests

Playwright-based end-to-end tests for the CRM app.

## Structure

```
test/
├── script/                       # Test sources
│   ├── helpers/
│   │   ├── auth.ts               # Canonical phone+OTP login flow
│   │   ├── config.ts             # Base URL, test phone/OTP, timeouts
│   │   └── evidence.ts           # Screenshot + logging helpers
│   ├── flows/
│   │   ├── leadFlow.ts           # Reusable lead-management flow
│   │   ├── adminUiFlow.ts        # Reusable admin invite/member flow
│   │   └── crmOperationsFlow.ts  # Reusable calendar/analytics/khata/AI
│   ├── lead-flows.spec.ts        # Independent: leads only
│   ├── admin-ui-flows.spec.ts    # Independent: admin UI only
│   ├── crm-operations-flows.spec.ts  # Independent: CRM ops only
│   ├── all-flows.spec.ts         # Master: runs every flow in one session
│   ├── playwright.config.ts
│   └── package.json
├── evidences/                    # Screenshots + logs, categorized by feature
│   ├── admin-ui/                 # Screenshots directly here (no subdirectories)
│   ├── all-flows/
│   ├── crm-operations/
│   ├── dashboard-operations/
│   ├── lead-flows/
│   └── playwright-report/        # HTML test report (index.html)
└── README.md
```

## Running

All commands run from `test/script`:

```powershell
# Individual suites
npx playwright test lead-flows.spec.ts --headed
npx playwright test admin-ui-flows.spec.ts --headed
npx playwright test crm-operations-flows.spec.ts --headed

# Everything in a single session
npx playwright test all-flows.spec.ts --headed
```

## Prerequisites

- Frontend running at http://localhost:3000
- Backend/auth services reachable so phone OTP `123456` succeeds for `8291537522`

## Adding a new feature suite

1. Create `flows/<feature>Flow.ts` exporting a `run<Feature>Flow(page, ctx)` function.
2. Create `<feature>-flows.spec.ts` that logs in via `loginWithPhoneOtp` and calls the flow.
3. Register the flow in `all-flows.spec.ts`.
4. Evidence (screenshots) will land directly in `evidences/<feature>/` automatically.
