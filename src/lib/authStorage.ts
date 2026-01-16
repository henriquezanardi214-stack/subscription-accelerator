import type { Session } from "@supabase/supabase-js";

const STORAGE_KEY_PATTERN = /^sb-.*-auth-token$/;

/**
 * Resolve the localStorage key used by Supabase auth.
 * Works even when `supabase.auth.storageKey` is undefined at runtime.
 */
export function resolveAuthStorageKey(): string | null {
  // Try using VITE env variable (project id)
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  if (projectId) {
    return `sb-${projectId}-auth-token`;
  }

  // Fallback: scan localStorage for known pattern
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && STORAGE_KEY_PATTERN.test(key)) {
        return key;
      }
    }
  } catch {
    // localStorage not available
  }

  return null;
}

/**
 * Extract session object from storage value (handles different shapes).
 */
function extractSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;

  const v = value as Record<string, unknown>;
  const candidate = v.currentSession ?? v.session ?? v;

  if (
    candidate &&
    typeof candidate === "object" &&
    "access_token" in candidate &&
    "refresh_token" in candidate &&
    "user" in candidate
  ) {
    return candidate as Session;
  }

  return null;
}

/**
 * Read the current session from localStorage (no network call).
 */
export function readStoredSession(): Session | null {
  try {
    const key = resolveAuthStorageKey();
    if (!key) return null;

    const raw = localStorage.getItem(key);
    if (!raw) return null;

    return extractSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Check if a session is likely still valid (not expired).
 */
export function isSessionValid(session: Session | null): session is Session {
  if (!session?.user?.id) return false;

  const expiresAt = (session as { expires_at?: number }).expires_at;
  if (typeof expiresAt === "number") {
    const now = Math.floor(Date.now() / 1000);
    return expiresAt > now + 30; // 30s buffer
  }

  return true;
}
