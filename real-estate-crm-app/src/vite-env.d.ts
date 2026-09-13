/// <reference types="vite/client" />

// Crisp chat widget global
interface Window {
  $crisp?: Array<unknown[]>;
}

interface ImportMetaEnv {
  // API endpoints: custom domain (bare host) + single-segment base path per API.
  // Read ONLY by src/config/apiConfig.ts, which appends /api, /mcp etc. and
  // rejects raw execute-api hosts. A domain containing :// is a local-dev origin.
  readonly VITE_CRM_API_DOMAIN_NAME: string;
  readonly VITE_CRM_API_BASE_PATH: string;
  readonly VITE_AUTH_API_DOMAIN_NAME: string;
  readonly VITE_AUTH_API_BASE_PATH: string;
  // Optional — leave blank where no MCP server is deployed; the Claude Desktop
  // setup snippet is then replaced with a "not available" notice.
  readonly VITE_MCP_API_DOMAIN_NAME?: string;
  readonly VITE_MCP_API_BASE_PATH?: string;

  readonly VITE_TENANT_ID: string;
  readonly VITE_PORT?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_HCAPTCHA_SITE_KEY?: string;
  readonly VITE_GRIEVANCE_OFFICER_NAME?: string;
  readonly VITE_IS_DEMO?: string;
  // Support WhatsApp number, digits only with country code (e.g. 919876543210).
  // Support links are hidden when this is unset rather than rendering a dead link.
  readonly VITE_SUPPORT_WHATSAPP?: string;
  // Base URL of the hosted legal documents (privacy, terms, cookies, refund).
  // Defaults to https://realestateflow.in/legal.
  readonly VITE_LEGAL_BASE_URL?: string;
  // Base URL of the property-pages-ms fallback path routing (<base>/t/<slug>/...).
  // Used to build the shareable public-listing link; the link is hidden when unset.
  readonly VITE_PUBLIC_PAGES_BASE_URL?: string;

  // Auth configuration
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  readonly VITE_AUTH_REDIRECT_URI: string;
  readonly VITE_AUTH_LOGOUT_URI: string;

  // AI Calling (optional)
  // No VITE_AI_CALLING_* URL: the browser reaches AI calling only through the
  // CRM API proxy (see services/aiCallingApi.ts).
  readonly VITE_AI_CALLING_ENABLED?: string;

  // Mobile build. Set to 'true' by `npm run build:mobile`.
  // Read only via src/lib/platform.ts — do not branch on it directly.
  readonly VITE_IS_NATIVE_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
