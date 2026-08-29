/**
 * Hydrates process.env from SSM Parameter Store at Lambda cold start.
 *
 * CloudFormation keeps Lambda's own Environment.Variables down to the bare
 * minimum needed before this can even run (NODE_ENV, SSM_CONFIG_PATH) —
 * everything else this service reads via process.env.X (table names, API
 * keys, feature flags — ~100 values) lives in SSM under SSM_CONFIG_PATH
 * instead, synced there by cfn-templates-cicd/server/deploy.sh. This module
 * fetches them once per container and assigns them onto process.env under
 * their original names, so every existing `process.env.X` read elsewhere in
 * the codebase keeps working unchanged.
 *
 * Must run — and finish — before anything that reads those values is
 * imported. lambda-handler.js and workers/callRecordingWorker.js both defer
 * their real entry point behind a dynamic import() gated on hydrate(), since
 * ES module `import` statements at the top of a file are hoisted and would
 * otherwise run before this does.
 */
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

let hydratePromise = null;

async function fetchAllParameters(client, path) {
  const parameters = [];
  let nextToken;
  do {
    const response = await client.send(
      new GetParametersByPathCommand({
        Path: path,
        Recursive: true,
        WithDecryption: true,
        NextToken: nextToken,
      })
    );
    parameters.push(...(response.Parameters || []));
    nextToken = response.NextToken;
  } while (nextToken);
  return parameters;
}

export function hydrateConfigFromSsm() {
  if (hydratePromise) {
    return hydratePromise;
  }

  hydratePromise = (async () => {
    const path = process.env.SSM_CONFIG_PATH;
    // No prefix configured — e.g. local dev running off a plain .env file
    // directly. Nothing to hydrate; existing process.env values stand as-is.
    if (!path) {
      return;
    }

    const client = new SSMClient({});
    const parameters = await fetchAllParameters(client, path);

    for (const parameter of parameters) {
      const shortName = parameter.Name.slice(path.length);
      if (!shortName) {
        continue;
      }
      // A value set directly on the Lambda (NODE_ENV, SSM_CONFIG_PATH
      // itself) always wins over SSM — SSM only fills in what's missing.
      if (process.env[shortName] === undefined) {
        process.env[shortName] = parameter.Value ?? '';
      }
    }
  })();

  return hydratePromise;
}
