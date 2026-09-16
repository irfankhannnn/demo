/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * API Gateway custom domain of the Instagram microservice API (bare hostname,
   * e.g. services-api.realestateflow.in). A full origin is accepted for local dev
   * only. Raw API Gateway invoke hosts are rejected. See src/config.ts.
   */
  readonly VITE_INSTA_API_DOMAIN_NAME: string;
  /** Base path mapping on that domain (devrealestateinsta / prodrealestateinsta). `/api/insta` is appended by the client. */
  readonly VITE_INSTA_API_BASE_PATH: string;
  /** Origin of the CRM app — "Back to CRM" link and the 401 login redirect. */
  readonly VITE_CRM_URL: string;
  readonly VITE_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
