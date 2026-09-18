/**
 * In-memory stand-ins for the AWS SDK clients, injected through
 * utils/aws.ts's test seam. They implement only the subset of DynamoDB
 * update/query/condition syntax and Cognito commands this service uses,
 * and they throw loudly on anything else so a new code path can't pass
 * silently against a fake that ignores it.
 */
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { Application } from 'express';
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
export const TEST_ENV: Record<string, string> = {
  AWS_REGION: 'ap-south-1',
  ENV: 'test',
  LOG_LEVEL: 'error',
  COGNITO_USER_POOL_ID: 'ap-south-1_TESTPOOL',
  COGNITO_CLIENT_ID: 'testclientid',
  COGNITO_HOSTED_UI_DOMAIN: 'https://test-realestateflow-marketplace-auth.auth.ap-south-1.amazoncognito.com',
  USERS_TABLE: 'test-realestateflow-marketplace-auth-users',
  IDENTITIES_TABLE: 'test-realestateflow-marketplace-auth-identities',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  INTERNAL_API_KEY: 'internal-secret-key',
  MARKETPLACE_API_DOMAIN_NAME: 'marketplace-api.example.test',
  MARKETPLACE_API_BASE_PATH: 'devmarketplaceapi',
  AUTH_CALLER_API_KEY: 'auth-caller-key',
  RATE_LIMIT_DISABLED: 'true',
};

export function applyTestEnv(): void {
  for (const [k, v] of Object.entries(TEST_ENV)) process.env[k] = v;
}

// ---------------------------------------------------------------------------
// DynamoDB (DocumentClient) fake
// ---------------------------------------------------------------------------
type Item = Record<string, unknown>;

class ConditionalCheckFailedException extends Error {
  constructor() {
    super('The conditional request failed');
    this.name = 'ConditionalCheckFailedException';
  }
}

function keyOf(key: Item): string {
  return JSON.stringify(Object.keys(key).sort().map((k) => [k, key[k]]));
}

function resolveName(token: string, names?: Record<string, string>): string {
  return token.startsWith('#') ? (names?.[token] ?? token) : token;
}

function evalCondition(expr: string | undefined, item: Item | undefined, names?: Record<string, string>): boolean {
  if (!expr) return true;
  return expr.split(/\s+AND\s+/i).every((clause) => {
    const m = clause.trim().match(/^attribute_(not_)?exists\(([^)]+)\)$/);
    if (!m) throw new Error(`fake dynamo: unsupported condition "${clause}"`);
    const attr = resolveName(m[2].trim(), names);
    const exists = !!item && item[attr] !== undefined;
    return m[1] ? !exists : exists;
  });
}

function applyUpdate(
  item: Item,
  expr: string,
  names?: Record<string, string>,
  values?: Record<string, unknown>
): void {
  const setMatch = expr.match(/SET\s+(.*?)(?=\s+REMOVE\s|$)/is);
  const removeMatch = expr.match(/REMOVE\s+(.*?)(?=\s+SET\s|$)/is);

  if (setMatch) {
    for (const assignment of setMatch[1].split(/,\s*(?![^()]*\))/)) {
      const [lhs, rhs] = assignment.split('=').map((s) => s.trim());
      const attr = resolveName(lhs, names);
      const ine = rhs.match(/^if_not_exists\(([^,]+),\s*([^)]+)\)$/);
      if (ine) {
        const existingAttr = resolveName(ine[1].trim(), names);
        if (item[existingAttr] === undefined) item[attr] = values?.[ine[2].trim()];
      } else if (rhs.startsWith(':')) {
        item[attr] = values?.[rhs];
      } else {
        throw new Error(`fake dynamo: unsupported SET rhs "${rhs}"`);
      }
    }
  }
  if (removeMatch) {
    for (const token of removeMatch[1].split(',')) {
      delete item[resolveName(token.trim(), names)];
    }
  }
}

export class FakeDynamo {
  tables = new Map<string, Map<string, Item>>();

  private table(name: string | undefined): Map<string, Item> {
    if (!name) throw new Error('fake dynamo: TableName missing');
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  items(tableName: string): Item[] {
    return [...this.table(tableName).values()].map((i) => ({ ...i }));
  }

  async send(command: unknown): Promise<any> {
    if (command instanceof GetCommand) {
      const { TableName, Key } = command.input;
      const item = this.table(TableName).get(keyOf(Key as Item));
      return { Item: item ? { ...item } : undefined };
    }
    if (command instanceof PutCommand) {
      const { TableName, Item: newItem, ConditionExpression, ExpressionAttributeNames } = command.input;
      const t = this.table(TableName);
      const pk = TableName?.endsWith('identities') ? 'sub' : 'UserId';
      const k = keyOf({ [pk]: (newItem as Item)[pk] });
      if (!evalCondition(ConditionExpression, t.get(k), ExpressionAttributeNames)) throw new ConditionalCheckFailedException();
      t.set(k, { ...(newItem as Item) });
      return {};
    }
    if (command instanceof UpdateCommand) {
      const { TableName, Key, UpdateExpression, ConditionExpression, ExpressionAttributeNames, ExpressionAttributeValues, ReturnValues } =
        command.input;
      const t = this.table(TableName);
      const k = keyOf(Key as Item);
      const existing = t.get(k);
      if (!evalCondition(ConditionExpression, existing, ExpressionAttributeNames)) throw new ConditionalCheckFailedException();
      const item = existing ? { ...existing } : { ...(Key as Item) };
      applyUpdate(item, UpdateExpression ?? '', ExpressionAttributeNames, ExpressionAttributeValues);
      t.set(k, item);
      return ReturnValues === 'ALL_NEW' ? { Attributes: { ...item } } : {};
    }
    if (command instanceof QueryCommand) {
      const { TableName, KeyConditionExpression, ExpressionAttributeNames, ExpressionAttributeValues, Limit } = command.input;
      const m = (KeyConditionExpression ?? '').match(/^\s*([#\w]+)\s*=\s*(:\w+)\s*$/);
      if (!m) throw new Error(`fake dynamo: unsupported KeyConditionExpression "${KeyConditionExpression}"`);
      const attr = resolveName(m[1], ExpressionAttributeNames);
      const value = ExpressionAttributeValues?.[m[2]];
      const matches = [...this.table(TableName).values()].filter((i) => i[attr] === value).map((i) => ({ ...i }));
      return { Items: Limit ? matches.slice(0, Limit) : matches, Count: matches.length };
    }
    if (command instanceof DeleteCommand) {
      const { TableName, Key } = command.input;
      this.table(TableName).delete(keyOf(Key as Item));
      return {};
    }
    throw new Error(`fake dynamo: unsupported command ${(command as { constructor: { name: string } }).constructor.name}`);
  }
}

// ---------------------------------------------------------------------------
// Cognito fake
// ---------------------------------------------------------------------------
export interface FakeCognitoUser {
  username: string;
  sub: string;
  enabled: boolean;
  attributes: Record<string, string>;
}

export function unsignedJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.sig`;
}

function cognitoError(name: string, message = name): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

export class FakeCognito {
  users = new Map<string, FakeCognitoUser>(); // keyed by username (phone) AND by sub
  sessions = new Map<string, { username: string; attempts: number }>();
  calls: { name: string; input: any }[] = [];
  correctOtp = '123456';
  refreshTokens = new Set<string>();
  private counter = 0;

  private find(username: string): FakeCognitoUser | undefined {
    return this.users.get(username);
  }

  seedUser(username: string, attributes: Record<string, string> = {}, enabled = true): FakeCognitoUser {
    const sub = `sub-${++this.counter}`;
    const user: FakeCognitoUser = { username, sub, enabled, attributes: { sub, ...attributes } };
    this.users.set(username, user);
    this.users.set(sub, user);
    return user;
  }

  private tokensFor(user: FakeCognitoUser) {
    const refresh = `refresh-${user.sub}-${++this.counter}`;
    this.refreshTokens.add(refresh);
    const base = { sub: user.sub, 'cognito:username': user.username, iss: 'fake', exp: 9999999999 };
    return {
      AccessToken: unsignedJwt({ ...base, token_use: 'access', client_id: TEST_ENV.COGNITO_CLIENT_ID }),
      IdToken: unsignedJwt({
        ...base,
        token_use: 'id',
        aud: TEST_ENV.COGNITO_CLIENT_ID,
        phone_number: user.attributes.phone_number,
        phone_number_verified: user.attributes.phone_number_verified === 'true',
        email: user.attributes.email,
        name: user.attributes.name,
      }),
      RefreshToken: refresh,
      ExpiresIn: 3600,
      TokenType: 'Bearer',
    };
  }

  async send(command: unknown): Promise<any> {
    const name = (command as { constructor: { name: string } }).constructor.name;
    const input = (command as { input: any }).input;
    this.calls.push({ name, input });

    switch (name) {
      case 'AdminGetUserCommand': {
        const u = this.find(input.Username);
        if (!u) throw cognitoError('UserNotFoundException');
        return {
          Username: u.username,
          Enabled: u.enabled,
          UserAttributes: Object.entries(u.attributes).map(([Name, Value]) => ({ Name, Value })),
        };
      }
      case 'AdminCreateUserCommand': {
        if (this.find(input.Username)) throw cognitoError('UsernameExistsException');
        const attrs: Record<string, string> = {};
        for (const a of input.UserAttributes ?? []) attrs[a.Name] = a.Value;
        this.seedUser(input.Username, attrs);
        return {};
      }
      case 'AdminEnableUserCommand': {
        const u = this.find(input.Username);
        if (!u) throw cognitoError('UserNotFoundException');
        u.enabled = true;
        return {};
      }
      case 'AdminDisableUserCommand': {
        const u = this.find(input.Username);
        if (!u) throw cognitoError('UserNotFoundException');
        u.enabled = false;
        return {};
      }
      case 'AdminUserGlobalSignOutCommand':
        return {};
      case 'AdminUpdateUserAttributesCommand': {
        const u = this.find(input.Username);
        if (!u) throw cognitoError('UserNotFoundException');
        for (const a of input.UserAttributes ?? []) u.attributes[a.Name] = a.Value;
        return {};
      }
      case 'AdminInitiateAuthCommand': {
        const u = this.find(input.AuthParameters?.USERNAME);
        if (!u) throw cognitoError('UserNotFoundException');
        if (!u.enabled) throw cognitoError('NotAuthorizedException', 'User is disabled.');
        const session = `session-${++this.counter}`;
        this.sessions.set(session, { username: u.username, attempts: 0 });
        return { ChallengeName: 'CUSTOM_CHALLENGE', Session: session, ChallengeParameters: { phoneNumber: u.username } };
      }
      case 'RespondToAuthChallengeCommand': {
        const s = this.sessions.get(input.Session);
        if (!s) throw cognitoError('NotAuthorizedException', 'Invalid session for the user.');
        this.sessions.delete(input.Session);
        const u = this.find(s.username)!;
        if (input.ChallengeResponses?.ANSWER !== this.correctOtp) {
          if (s.attempts + 1 >= 3) throw cognitoError('NotAuthorizedException', 'Incorrect username or password.');
          const next = `session-${++this.counter}`;
          this.sessions.set(next, { username: s.username, attempts: s.attempts + 1 });
          return { ChallengeName: 'CUSTOM_CHALLENGE', Session: next };
        }
        return { AuthenticationResult: this.tokensFor(u) };
      }
      case 'InitiateAuthCommand': {
        if (input.AuthFlow !== 'REFRESH_TOKEN_AUTH') throw new Error(`fake cognito: unsupported flow ${input.AuthFlow}`);
        const token = input.AuthParameters?.REFRESH_TOKEN as string;
        if (!this.refreshTokens.has(token)) throw cognitoError('NotAuthorizedException', 'Invalid Refresh Token');
        const sub = token.match(/^refresh-(sub-\d+)-/)?.[1] ?? '';
        const u = this.find(sub)!;
        const { RefreshToken: _drop, ...rest } = this.tokensFor(u);
        return { AuthenticationResult: rest };
      }
      case 'RevokeTokenCommand':
        this.refreshTokens.delete(input.Token);
        return {};
      default:
        throw new Error(`fake cognito: unsupported command ${name}`);
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP helper — real Express server on an ephemeral port, no supertest.
// ---------------------------------------------------------------------------
export interface TestServer {
  url: string;
  close: () => Promise<void>;
  request: (
    method: string,
    path: string,
    opts?: { body?: unknown; headers?: Record<string, string> }
  ) => Promise<{ status: number; body: any; headers: Headers }>;
}

export function startTestServer(app: Application): Promise<TestServer> {
  return new Promise((resolve) => {
    const server: Server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${port}`;
      resolve({
        url,
        close: () => new Promise((r) => server.close(() => r())),
        request: async (method, path, opts = {}) => {
          const res = await fetch(`${url}${path}`, {
            method,
            headers: {
              ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
              ...(opts.headers ?? {}),
            },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          });
          const text = await res.text();
          let body: any = text;
          try {
            body = text ? JSON.parse(text) : null;
          } catch {
            /* keep text */
          }
          return { status: res.status, body, headers: res.headers };
        },
      });
    });
  });
}
