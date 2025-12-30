/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_DB_HOST: string
  readonly VITE_DB_PORT: string
  readonly VITE_DB_DATABASE: string
  readonly VITE_DB_USERNAME: string
  readonly VITE_DB_PASSWORD: string
  readonly VITE_DB_SSL: string
  readonly VITE_ENCRYPTION_KEY: string
  readonly VITE_FC_ENDPOINT: string
  readonly VITE_FC_ACCESS_KEY_ID: string
  readonly VITE_FC_ACCESS_KEY_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}