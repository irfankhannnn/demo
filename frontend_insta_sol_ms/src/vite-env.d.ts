/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the Instagram microservice API. `/api/insta` is appended by the client. */
  readonly VITE_API_BASE_URL: string;
  /** Origin of the CRM app — "Back to CRM" link and the 401 login redirect. */
  readonly VITE_CRM_URL: string;
  readonly VITE_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
