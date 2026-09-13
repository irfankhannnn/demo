import {
  buildServiceBaseUrl,
  getAuthServiceBaseUrl,
  getMcpApiBaseUrl,
  getAiCallingServiceBaseUrl,
  ServiceUrlConfigError,
} from './serviceUrls.js';

const VARS = [
  'AUTH_SERVICE_DOMAIN_NAME',
  'AUTH_SERVICE_BASE_PATH',
  'MCP_API_DOMAIN_NAME',
  'MCP_API_BASE_PATH',
  'AI_CALLING_SERVICE_DOMAIN_NAME',
  'AI_CALLING_SERVICE_BASE_PATH',
];
const saved = {};

beforeEach(() => {
  for (const key of VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('buildServiceBaseUrl', () => {
  test('composes https origin and a single base path segment', () => {
    expect(buildServiceBaseUrl('services-api.cloudberrysolutions.in', 'devrealestateauth'))
      .toBe('https://services-api.cloudberrysolutions.in/devrealestateauth');
  });

  test('trims whitespace and surrounding slashes', () => {
    expect(buildServiceBaseUrl('  services-api.realestateflow.in/ ', ' /prodrealestateauth/ '))
      .toBe('https://services-api.realestateflow.in/prodrealestateauth');
  });

  test('empty base path yields the bare origin', () => {
    expect(buildServiceBaseUrl('services-api.realestateflow.in', '')).toBe('https://services-api.realestateflow.in');
  });

  test('a scheme-qualified value is used as-is (local dev)', () => {
    expect(buildServiceBaseUrl('http://localhost:3002/', undefined)).toBe('http://localhost:3002');
  });

  test('empty domain fails naming the env var', () => {
    expect(() => buildServiceBaseUrl('  ', 'x', 'AUTH_SERVICE_DOMAIN_NAME'))
      .toThrow(/AUTH_SERVICE_DOMAIN_NAME/);
  });

  test.each([
    'gpjh2iy6h4.execute-api.ap-south-1.amazonaws.com',
    'https://0e40r6uwoh.execute-api.ap-south-1.amazonaws.com/prod',
    'something.amazonaws.com',
  ])('rejects raw API Gateway host %s', (domain) => {
    expect(() => buildServiceBaseUrl(domain, 'dev')).toThrow(ServiceUrlConfigError);
    expect(() => buildServiceBaseUrl(domain, 'dev')).toThrow(/raw API Gateway URLs are not allowed/);
  });
});

describe('service getters', () => {
  test('auth is required', () => {
    expect(() => getAuthServiceBaseUrl()).toThrow(/AUTH_SERVICE_DOMAIN_NAME/);
    process.env.AUTH_SERVICE_DOMAIN_NAME = 'services-api.cloudberrysolutions.in';
    process.env.AUTH_SERVICE_BASE_PATH = 'devrealestateauth';
    expect(getAuthServiceBaseUrl()).toBe('https://services-api.cloudberrysolutions.in/devrealestateauth');
  });

  test('MCP is optional: blank domain means not configured', () => {
    process.env.MCP_API_DOMAIN_NAME = '';
    expect(getMcpApiBaseUrl()).toBeNull();
    process.env.MCP_API_DOMAIN_NAME = 'services-api.cloudberrysolutions.in';
    process.env.MCP_API_BASE_PATH = 'devrealestatemcp';
    expect(getMcpApiBaseUrl()).toBe('https://services-api.cloudberrysolutions.in/devrealestatemcp');
  });

  test('MCP still rejects a raw invoke URL', () => {
    process.env.MCP_API_DOMAIN_NAME = '2v2p518vu9.execute-api.ap-south-1.amazonaws.com';
    expect(() => getMcpApiBaseUrl()).toThrow(ServiceUrlConfigError);
  });

  test('AI calling is optional and carries the /api/ai-calling prefix', () => {
    expect(getAiCallingServiceBaseUrl()).toBeNull();
    process.env.AI_CALLING_SERVICE_DOMAIN_NAME = 'services-api.cloudberrysolutions.in';
    process.env.AI_CALLING_SERVICE_BASE_PATH = 'devrealestatecalling';
    expect(getAiCallingServiceBaseUrl())
      .toBe('https://services-api.cloudberrysolutions.in/devrealestatecalling/api/ai-calling');
  });
});
