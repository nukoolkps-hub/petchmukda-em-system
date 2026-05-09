/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS: string;
  readonly VITE_LINE_LOGIN_CHANNEL_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
