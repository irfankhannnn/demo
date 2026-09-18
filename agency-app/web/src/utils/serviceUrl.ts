/**
 * Composes an API base URL from an API Gateway custom domain + base path.
 *
 * Every API this app calls is reached through a custom domain
 * (services-api.cloudberrysolutions.in / services-api.realestateflow.in) plus a
 * single-segment base path mapping (e.g. `devrealestatecrm`). Raw
 * `https://<id>.execute-api.<region>.amazonaws.com/<stage>` invoke URLs are
 * rejected outright: they change whenever a stack is recreated and bypass the
 * mapping the backend's base-path strip expects.
 *
 * `domainName` is normally a bare host. A value containing `://` is accepted
 * as a full origin for local development only (e.g. `http://localhost:4000`).
 * The app's own route prefixes (`/api`, `/mcp`) are appended by the caller,
 * never baked into env values.
 */
export function buildServiceBaseUrl(
  domainName: string | undefined,
  basePath: string | undefined,
  domainEnvVar: string,
): string {
  const domain = (domainName ?? '').trim();
  if (!domain) {
    throw new Error(`${domainEnvVar} is not set. Set it in the frontend .env.<mode> file.`);
  }

  let origin = domain.includes('://') ? domain : `https://${domain}`;
  origin = origin.replace(/\/+$/, '');

  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    throw new Error(`${domainEnvVar} ('${domain}') is not a valid host name.`);
  }
  if (/execute-api\.|\.amazonaws\.com/i.test(host)) {
    throw new Error(
      `${domainEnvVar} ('${domain}'): raw API Gateway URLs are not allowed; use the custom domain.`,
    );
  }

  const bp = (basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}
