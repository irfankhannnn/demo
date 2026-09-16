// Set required environment variables for tests before modules are imported.
process.env.BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
process.env.GEMINI_CLASSIFIER_MODEL = process.env.GEMINI_CLASSIFIER_MODEL || 'gemini-2.5-flash';
process.env.DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '+91';

// crmDynamodbService / agencyConfigService throw at import time if these are
// unset, and vectorSearchService captures the table name at import. Every
// suite mocks the AWS SDK, so the values are never connected to — they only
// have to exist. Mirrors the placeholders .github/workflows/server-tests.yml
// sets, so a local `npm test` behaves the same as CI (without them, suites
// that pass in CI fail locally unless a developer's server/.env happens to
// define them). Setting them here also wins over server/.env (dotenv never
// overrides an existing var), so tests can't pick up real table names.
process.env.CRM_DYNAMODB_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME || 'test-placeholder-crm-table';
process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME = process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME || 'test-placeholder-agency-config';
process.env.AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
