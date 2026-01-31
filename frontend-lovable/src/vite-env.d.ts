/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PORT: string;
  readonly VITE_HOST: string;
  readonly VITE_ENABLE_CAPTCHA: string;
  readonly VITE_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

