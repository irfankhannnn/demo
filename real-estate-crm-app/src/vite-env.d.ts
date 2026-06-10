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
  readonly VITE_IS_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
