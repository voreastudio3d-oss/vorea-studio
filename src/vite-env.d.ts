/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATABASE_MODE: "supabase" | "local";
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_KEY: string;
  readonly VITE_OWNER_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
