/**
 * Hydrates process.env from AWS Secrets Manager at Lambda cold start.
 *
 * CloudFormation keeps the Lambda's own Environment.Variables limited to
 * non-secret config (table name, base URLs, policy defaults) plus SECRETS_ARN.
 * Every credential — CRM_INTERNAL_API_KEY, AI_CALLING_CALLER_API_KEY,
 * CRM_CALLER_API_KEY — lives in the Secrets Manager secret that SECRETS_ARN
 * points at, as a flat JSON object keyed by the same names. This module
 * fetches it once per container and assigns those keys onto process.env, so
 * every `process.env.X` read elsewhere keeps working unchanged.
 *
 * Same cached-promise shape and "a real Lambda env var always wins" rule as
 * services/ai-calling-service/src/config/secretsBootstrap.js.
 *
 * Must run — and finish — before anything that reads those values is
 * imported. Both Lambda entry points defer their real module behind a dynamic
 * import() gated on hydrate(), since top-level ES imports are hoisted.
 */
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let hydratePromise = null;

export function hydrateConfigFromSecrets() {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const secretId = process.env.SECRETS_ARN;
    // No secret configured — local dev off a plain .env file. Nothing to do.
    if (!secretId) return;

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
      if (process.env[key] === undefined) {
        process.env[key] = value == null ? '' : String(value);
      }
    }
  })();

  return hydratePromise;
}

/** Test hook: forget the cached hydration so a suite can re-run it. */
export function resetHydration() {
  hydratePromise = null;
}

export default hydrateConfigFromSecrets;
