/**
 * Client Registry — Stores and retrieves dynamically registered OAuth clients
 *
 * Implements OAuth 2.0 Dynamic Client Registration (RFC 7591).
 * Clients are stored in OAUTH_CODES_TABLE with type='registered_client'.
 * No TTL is set — registered clients persist indefinitely unless explicitly deleted.
 *
 * DCR clients are public clients (no client_secret). Authentication is
 * done exclusively via PKCE (code_challenge / code_verifier).
 */

import { v4 as uuidv4 } from 'uuid';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { logger } from '../utils/logger';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const OAUTH_TABLE = process.env.OAUTH_CODES_TABLE_NAME || 'realtyflow-oauth-codes';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Defensive limits for client metadata
const MAX_CLIENT_NAME_LENGTH = 100;
const MAX_REDIRECT_URIS = 10;

// Allowed characters for client_name: letters, numbers, spaces, hyphens, dots
const CLIENT_NAME_PATTERN = /^[\w\s\-\.]+$/;

export interface RegisteredClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: 'none';
  registered_at: string;
  type: 'registered_client';
}

/**
 * Validate and sanitize a redirect_uri.
 * Returns the normalized URI or throws an error with a safe description.
 */
export function validateRedirectUri(uri: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Invalid redirect_uri');
  }

  if (parsed.protocol !== 'https:') {
    // Allow localhost only for development with specific ports
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      // Common dev ports + mcp-remote default port (9547) + CRM backend (4000)
      const allowedPorts = [3000, 3001, 4000, 5000, 5173, 5174, 4173, 8000, 8080, 9547];
      const port = parsed.port ? parseInt(parsed.port, 10) : NaN;
      if (!allowedPorts.includes(port)) {
        throw new Error('Invalid localhost port for redirect_uri');
      }
    } else {
      throw new Error('redirect_uri must use https:');
    }
  }

  // Normalize: remove trailing slash and fragment
  const normalized = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  return normalized;
}

/**
 * Register a new OAuth client via Dynamic Client Registration.
 * Returns the stored client metadata including the generated client_id.
 */
export async function registerClient(metadata: {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}): Promise<RegisteredClient> {
  if (!metadata.redirect_uris || !Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length === 0) {
    throw new Error('redirect_uris is required and must be a non-empty array');
  }

  if (metadata.redirect_uris.length > MAX_REDIRECT_URIS) {
    throw new Error(`Maximum ${MAX_REDIRECT_URIS} redirect_uris allowed per client`);
  }

  // Validate client_name
  const client_name = (metadata.client_name || 'Unknown Client').trim();
  if (client_name.length === 0) {
    throw new Error('client_name cannot be empty');
  }
  if (client_name.length > MAX_CLIENT_NAME_LENGTH) {
    throw new Error(`client_name must be ${MAX_CLIENT_NAME_LENGTH} characters or less`);
  }
  if (!CLIENT_NAME_PATTERN.test(client_name)) {
    throw new Error('client_name contains invalid characters');
  }

  // Validate and normalize redirect_uris
  const redirect_uris = metadata.redirect_uris.map((uri) => {
    if (typeof uri !== 'string') {
      throw new Error('redirect_uris must contain only strings');
    }
    return validateRedirectUri(uri);
  });

  // Deduplicate redirect URIs
  const uniqueRedirectUris = [...new Set(redirect_uris)];

  const client_id = `dcr_${uuidv4()}`;

  const client: RegisteredClient = {
    client_id,
    client_name,
    redirect_uris: uniqueRedirectUris,
    grant_types: metadata.grant_types || ['authorization_code', 'refresh_token'],
    response_types: metadata.response_types || ['code'],
    token_endpoint_auth_method: 'none', // DCR clients are always public (PKCE only)
    registered_at: new Date().toISOString(),
    type: 'registered_client',
  };

  await docClient.send(
    new PutCommand({
      TableName: OAUTH_TABLE,
      Item: {
        code: client_id, // reuse 'code' as the partition key
        ...client,
      },
      ConditionExpression: 'attribute_not_exists(#c)',
      ExpressionAttributeNames: { '#c': 'code' },
    })
  );

  logger.info('clientRegistry.registered', {
    client_id,
    client_name: client.client_name,
    redirect_uris: client.redirect_uris,
  });

  return client;
}

/**
 * Retrieve a registered client by client_id.
 * Returns null if not found or not a DCR client.
 */
export async function getClient(client_id: string): Promise<RegisteredClient | null> {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: OAUTH_TABLE, Key: { code: client_id } })
    );
    const item = result.Item;
    if (!item || item.type !== 'registered_client') return null;
    return item as RegisteredClient;
  } catch (err: any) {
    logger.warn('clientRegistry.getClient.error', { client_id, error: err.message });
    return null;
  }
}

/**
 * Delete a registered client by client_id.
 * Returns true if deleted, false if not found or not a DCR client.
 */
export async function deleteClient(client_id: string): Promise<boolean> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: OAUTH_TABLE,
        Key: { code: client_id },
        ConditionExpression: 'attribute_exists(#c) AND #t = :type',
        ExpressionAttributeNames: { '#c': 'code', '#t': 'type' },
        ExpressionAttributeValues: { ':type': 'registered_client' },
      })
    );
    logger.info('clientRegistry.deleted', { client_id });
    return true;
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      logger.warn('clientRegistry.delete.not_found', { client_id });
    } else {
      logger.error('clientRegistry.delete.error', { client_id, error: err.message });
    }
    return false;
  }
}

/**
 * Returns true if the client_id was generated by DCR (prefixed with 'dcr_').
 */
export function isDcrClient(client_id: string): boolean {
  return typeof client_id === 'string' && client_id.startsWith('dcr_');
}

/**
 * Validate that a redirect_uri is registered for a given DCR client.
 */
export function isRedirectUriAllowed(
  client: { redirect_uris: string[] },
  redirect_uri: string
): boolean {
  return client.redirect_uris.includes(redirect_uri);
}
