/**
 * The one DynamoDB DocumentClient every repository shares.
 *
 * Built lazily so importing a repository never opens an AWS connection by
 * itself (tests import them freely), and swappable so the repositories can be
 * exercised against a scripted fake without any network. `setDocClient` is
 * for tests only; production code never calls it.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env.js';

let client = null;

export function getDocClient() {
  if (!client) {
    client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), {
      // Undefined attributes are simply omitted rather than throwing, and
      // empty strings are stored as-is (DynamoDB has allowed them since 2020).
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return client;
}

/** Test seam. Pass null to restore the real client on next use. */
export function setDocClient(fake) {
  client = fake;
}
