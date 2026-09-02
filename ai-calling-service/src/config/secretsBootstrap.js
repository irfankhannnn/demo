/**
 * Hydrates process.env from AWS Secrets Manager at Lambda cold start.
 *
 * CloudFormation keeps the Lambda's own Environment.Variables limited to
 * non-secret config (table names, base URLs, agent IDs) plus SECRETS_ARN.
 * Every credential this service needs — CRM_INTERNAL_API_KEY, EXOTEL_*,
 * ELEVENLABS_API_KEY, ELEVENLABS_WEBHOOK_SECRET, SERVER_TOOL_API_KEY — lives
 * in the Secrets Manager secret that SECRETS_ARN points at, stored as a flat
 * JSON object keyed by the same names. This module fetches it once per
 * container and assigns those keys onto process.env under their original
 * names, so every `process.env.X` read elsewhere keeps working unchanged.
 *
 * This mirrors server/config/ssmBootstrap.js (SSM Parameter Store) — same
 * cached-promise shape, same "a real Lambda env var always wins" rule — but
 * reads a single JSON secret rather than a parameter path, because that is
 * what ai-calling-service's CloudFormation template provisions.
 *
 * Must run — and finish — before anything that reads those values is
 * imported. lambda-handler.js defers its real entry point behind a dynamic
 * import() gated on hydrate(), since ES module `import` statements at the top
 * of a file are hoisted and would otherwise run before this does.
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let hydratePromise = null;

export function hydrateConfigFromSecrets() {
  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = (async () => {
    const secretId = process.env.SECRETS_ARN;
    // No secret configured — e.g. local dev running off a plain .env file
    // directly. Nothing to hydrate; existing process.env values stand as-is.
    if (!secretId) {
      return;
    }

    const client = new SecretsManagerClient({});
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));

    if (!response.SecretString) {
      throw new Error(`Secret ${secretId} has no SecretString payload`);
    }

    let parsed;
    try {
      parsed = JSON.parse(response.SecretString);
    } catch (error) {
      throw new Error(`Secret ${secretId} is not valid JSON: ${error.message}`);
    }

    for (const [key, value] of Object.entries(parsed)) {
      // A value set directly on the Lambda always wins over the secret —
      // the secret only fills in what's missing. Keeps local overrides and
      // CFN-injected plain vars authoritative.
      if (process.env[key] === undefined) {
        process.env[key] = value == null ? '' : String(value);
      }
    }
  })();

  return hydratePromise;
}

export default hydrateConfigFromSecrets;
