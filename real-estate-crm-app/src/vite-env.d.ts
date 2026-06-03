/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TENANT_ID: string;
  readonly VITE_PORT?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_HCAPTCHA_SITE_KEY?: string;
  readonly VITE_GRIEVANCE_OFFICER_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
