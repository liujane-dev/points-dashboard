/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHILD_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
