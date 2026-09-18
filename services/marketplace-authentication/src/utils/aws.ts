/**
 * Lazily-constructed AWS SDK v3 clients with a test seam.
 *
 * Controllers and models call getCognito()/getDynamo() instead of holding
 * module-level clients so tests can swap in fakes via
 * __setAwsClientsForTests() without touching the SDK or the network.
 */
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface AwsClients {
  cognito: Pick<CognitoIdentityProviderClient, 'send'>;
  dynamo: Pick<DynamoDBDocumentClient, 'send'>;
}

let clients: AwsClients | null = null;

function region(): string {
  return process.env.AWS_REGION || 'ap-south-1';
}

function build(): AwsClients {
  const cognito = new CognitoIdentityProviderClient({ region: region() });
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: region() }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return { cognito, dynamo };
}

export function getCognito(): AwsClients['cognito'] {
  if (!clients) clients = build();
  return clients.cognito;
}

export function getDynamo(): AwsClients['dynamo'] {
  if (!clients) clients = build();
  return clients.dynamo;
}

/** Test-only: inject fakes. Pass null to restore the real SDK clients. */
export function __setAwsClientsForTests(fakes: AwsClients | null): void {
  clients = fakes;
}
