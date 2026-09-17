# openapi/

One spec per gateway prefix, added when that prefix is built:

- `public.v1.yaml` — `/public/*` (listings search, enquiries, property pages)
- `agency.v1.yaml` — `/agency/*` (CRM, Instagram, calling, follow-ups)
- `auth.v1.yaml` — `/auth/*`

Until then the route inventory lives in each unit's CloudFormation template;
`tools/scripts/audit-apigw-routes.js` diffs `agency-app/api`'s Express routes
against its API Gateway template.
