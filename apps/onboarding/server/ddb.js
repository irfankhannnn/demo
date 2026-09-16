import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as dotenv from 'dotenv';

dotenv.config();

const REGION = process.env.AWS_REGION || 'ap-south-1';

// Points to server's consolidated AgencyConfig table — the single source of
// truth for tenant provisioning shared by reality-flow-authentication and
// server (see docs/proposals/agency-config-single-source/report.md):
//   prod-realestateflow-agencies
//   dev-realestateflow-agencies
// (NOT the old, retired "*-auth-agency-config" table that
// reality-flow-authentication used to own separately.)
const TABLE = process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME;

if (!TABLE) {
  throw new Error('AGENCY_CONFIG_DYNAMODB_TABLE_NAME is required in onboarding-page/.env (e.g. prod-realestateflow-agencies)');
}

// Uses AWS SDK default credential provider chain.
// Supported local options:
// - Environment variables: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
// - Shared credentials file: %USERPROFILE%\.aws\credentials (used by aws cli)
// - SSO / other providers configured for aws cli
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

export async function putAgencyConfig(item) {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Could not load credentials')) {
      throw new Error(
        [
          'AWS credentials not found for onboarding-page.',
          '',
          'Fix options:',
          '1) Set credentials in onboarding-page/.env:',
          '   AWS_ACCESS_KEY_ID=...',
          '   AWS_SECRET_ACCESS_KEY=...',
          '   AWS_REGION=ap-south-1',
          '',
          'OR',
          '2) Configure AWS CLI credentials file at %USERPROFILE%\\.aws\\credentials',
          '   (and optionally set AWS_PROFILE in your terminal when running node).',
        ].join('\n')
      );
    }
    throw err;
  }
}
