/// <reference types="vite/client" />

// Crisp chat widget global
interface Window {
  $crisp?: Array<unknown[]>;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TENANT_ID: string;
  readonly VITE_PORT?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_HCAPTCHA_SITE_KEY?: string;
  readonly VITE_GRIEVANCE_OFFICER_NAME?: string;
  readonly VITE_IS_DEMO?: string;
  // Support WhatsApp number, digits only with country code (e.g. 919876543210).
  // Support links are hidden when this is unset rather than rendering a dead link.
  readonly VITE_SUPPORT_WHATSAPP?: string;

  // Auth configuration
  readonly VITE_AUTH_API_URL: string;
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  readonly VITE_AUTH_REDIRECT_URI: string;
  readonly VITE_AUTH_LOGOUT_URI: string;

  // AI Calling (optional)
  readonly VITE_AI_CALLING_ENABLED?: string;
  readonly VITE_AI_CALLING_API_URL?: string;

  // Mobile build. Set to 'true' by `npm run build:mobile`.
  // Read only via src/lib/platform.ts — do not branch on it directly.
  readonly VITE_IS_NATIVE_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
