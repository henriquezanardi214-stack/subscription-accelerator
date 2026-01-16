import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tries to resolve the localStorage key used by the auth client.
 *
 * Why: depending on build/runtime, `supabase.auth.storageKey` might be undefined.
 * When that happens, reading the session from storage fails and the app is forced
 * to hit the network (which is exactly what we want to avoid in intermittent cases).
 */
export function resolveAuthStorageKey(): string | null {
  const explicit = (supabase.auth as any)?.storageKey;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  const projectId = (import.meta as any)?.env?.VITE_SUPABASE_PROJECT_ID as string | undefined;
  if (projectId) return `sb-${projectId}-auth-token`;

  // Last resort: scan storage for the known pattern.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) return k;
    }
  } catch {
    // ignore
  }

  return null;
}

export function extractSessionFromStorageValue(value: any): Session | null {
  if (!value) return null;
  const maybeSession = value.currentSession ?? value.session ?? value;
  if (maybeSession?.access_token && maybeSession?.refresh_token && maybeSession?.user) {
    return maybeSession as Session;
  }
  return null;
}

export function readAuthStorageRaw(): { key: string | null; value: unknown } {
  try {
    const key = resolveAuthStorageKey();
    if (!key) return { key: null, value: null };
    const raw = localStorage.getItem(key);
    return { key, value: raw ? JSON.parse(raw) : null };
  } catch {
    return { key: null, value: null };
  }
}

export function readStoredSession(): Session | null {
  const { value } = readAuthStorageRaw();
  return extractSessionFromStorageValue(value);
}

function backupKeyFor(baseKey: string | null): string {
  return baseKey ? `${baseKey}__backup_v1` : "sb-auth-token__backup_v1";
}

export function writeSessionBackup(session: Session): void {
  try {
    const baseKey = resolveAuthStorageKey();
    const backupKey = backupKeyFor(baseKey);
    localStorage.setItem(backupKey, JSON.stringify({ session, ts: Date.now() }));
  } catch {
    // ignore
  }
}

export function readSessionBackup(): Session | null {
  try {
    const baseKey = resolveAuthStorageKey();
    const backupKey = backupKeyFor(baseKey);
    const raw = localStorage.getItem(backupKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return extractSessionFromStorageValue(parsed?.session ?? parsed);
  } catch {
    return null;
  }
}

export function clearSessionBackup(): void {
  try {
    const baseKey = resolveAuthStorageKey();
    const backupKey = backupKeyFor(baseKey);
    localStorage.removeItem(backupKey);
  } catch {
    // ignore
  }
}
