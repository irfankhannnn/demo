/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_NAME?: string;
  readonly VITE_MARKETPLACE_API_URL?: string;
  readonly VITE_MARKETPLACE_AUTH_URL?: string;
  readonly VITE_GOOGLE_MAPS_EMBED_KEY?: string;
  readonly VITE_HCAPTCHA_SITE_KEY?: string;
  readonly VITE_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
