/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the deployed Kongsi Bill Worker API. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
