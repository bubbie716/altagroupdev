/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAIN_DOMAIN?: string;
  readonly VITE_BANK_DOMAIN?: string;
  readonly VITE_TERMINAL_DOMAIN?: string;
  readonly VITE_EXCHANGE_DOMAIN?: string;
  readonly VITE_DEV_MAIN_HOST?: string;
  readonly VITE_DEV_BANK_HOST?: string;
  readonly VITE_DEV_TERMINAL_HOST?: string;
  readonly VITE_DEV_EXCHANGE_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
