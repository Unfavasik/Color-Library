import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Ensure environment variables are loaded
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // .env might not exist in production or already loaded
  }
} else {
  // Fallback simple .env reader if process.loadEnvFile is unavailable
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Ignore fallback errors
  }
}

export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
export const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` : "");
export const SUPABASE_OAUTH_AUTHORIZE_URL = process.env.SUPABASE_OAUTH_AUTHORIZE_URL || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/oauth/authorize` : "");
export const SUPABASE_OAUTH_TOKEN_URL = process.env.SUPABASE_OAUTH_TOKEN_URL || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/oauth/token` : "");
export const SUPABASE_OPENID_CONFIG_URL = process.env.SUPABASE_OPENID_CONFIG_URL || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/.well-known/openid-configuration` : "");

let adminClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const key = process.env.SUPABASE_SECRET_KEY || SUPABASE_SECRET_KEY;
  const url = process.env.SUPABASE_URL || SUPABASE_URL;
  return Boolean(url && key);
}

export function getSupabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY || SUPABASE_SECRET_KEY;
  const url = process.env.SUPABASE_URL || SUPABASE_URL;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY environment variables are required for admin operations");
  }

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return adminClient;
}

export function getSupabasePublic(): SupabaseClient {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;
  const url = process.env.SUPABASE_URL || SUPABASE_URL;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables are required");
  }

  if (!publicClient) {
    publicClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return publicClient;
}

export function getSupabaseUserClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables are required");
  }

  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
