import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthRequiredError } from "@/lib/auth";

// Debug logging helper (lazy import to avoid circular deps)
let pushAuthLog: ((type: string, source: string, message: string, data?: unknown) => void) | null = null;
import("@/components/debug/AuthDebugPanel").then((m) => {
  pushAuthLog = m.pushAuthLog;
}).catch(() => {});
const log = (type: "event" | "storage" | "decision" | "error" | "info", source: string, msg: string, data?: unknown) => {
  pushAuthLog?.(type, source, msg, data);
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /** Attempts a session refresh (single-flight). Returns the new session (or null). */
  refresh: () => Promise<Session | null>;
  /** Waits for hydration and guarantees a user id (refreshing if needed). */
  ensureUserId: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getAuthStorageKey = (): string | undefined => {
  // supabase-js v2 exposes the storage key used for persistSession
  return (supabase.auth as any)?.storageKey as string | undefined;
};

const extractSessionFromStorageValue = (value: any): Session | null => {
  if (!value) return null;

  // Different builds can wrap it differently; try a few common shapes.
  const maybeSession = value.currentSession ?? value.session ?? value;

  if (maybeSession?.access_token && maybeSession?.refresh_token && maybeSession?.user) {
    return maybeSession as Session;
  }

  return null;
};

const readStoredSession = (): Session | null => {
  try {
    const key = getAuthStorageKey();
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return extractSessionFromStorageValue(JSON.parse(raw));
  } catch {
    return null;
  }
};

const isSessionLikelyValid = (s: Session | null): s is Session => {
  if (!s?.user?.id) return false;

  // expires_at is seconds since epoch.
  if (typeof (s as any).expires_at === "number") {
    const now = Math.floor(Date.now() / 1000);
    // Give a small buffer so we don't keep obviously-expired sessions.
    return (s as any).expires_at > now + 10;
  }

  // If we can't validate expiry, still treat it as "possibly valid".
  return true;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializedRef = useRef(false);
  const refreshInFlight = useRef<Promise<Session | null> | null>(null);

  useEffect(() => {
    let mounted = true;

    // We manage refresh explicitly (via ensureUserId/refresh). Auto-refresh can race during
    // initial hydration on some browsers/environments and briefly clear auth state.
    (supabase.auth as any).stopAutoRefresh?.();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      log("event", "onAuthStateChange", event, { userId: nextSession?.user?.id, expiresAt: (nextSession as any)?.expires_at });

      // If hydration produced no session (or an unexpected SIGNED_OUT), but a valid session is
      // still in storage, keep it. This shields the UI from transient refresh_token failures.
      if (!nextSession && (event === "INITIAL_SESSION" || event === "SIGNED_OUT")) {
        const stored = readStoredSession();
        if (isSessionLikelyValid(stored)) {
          log("decision", "AuthProvider", "Keeping storage session (transient failure)", { userId: stored.user.id });
          console.warn(
            `[auth] ${event} with null session, but storage still has a valid session; keeping it (likely transient network/CORS on refresh_token).`
          );
          setSession(stored);
          if (!initializedRef.current) initializedRef.current = true;
          setIsLoading(false);
          return;
        }
      }

      setSession(nextSession);

      const shouldInitialize =
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED";

      if (!initializedRef.current && shouldInitialize) {
        initializedRef.current = true;
        setIsLoading(false);
        log("decision", "AuthProvider", "Initialized", { event, hasSession: !!nextSession });
        return;
      }

      // After initialization, keep loading=false for subsequent events.
      if (initializedRef.current) {
        setIsLoading(false);
      }
    });

    // Safety net: do NOT eagerly call getSession() on mount if storage already has a valid session.
    // Calling getSession() can trigger a refresh_token request which may fail due to network/CORS.
    const storedOnBoot = readStoredSession();
    if (isSessionLikelyValid(storedOnBoot)) {
      setSession(storedOnBoot);
      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsLoading(false);
      }
    } else {
      // Only then ask the auth client.
      supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.warn("[auth] getSession error (boot safety net):", error);
        } else {
          setSession(data.session);
        }

        if (!initializedRef.current) {
          initializedRef.current = true;
          setIsLoading(false);
        }
      });
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async (): Promise<Session | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn("[auth] refreshSession error:", error);
          return null;
        }
        setSession(data.session);
        return data.session ?? null;
      })().finally(() => {
        refreshInFlight.current = null;
      });
    }

    return refreshInFlight.current;
  }, []);

  const waitForHydration = useCallback(async (timeoutMs = 5000) => {
    const start = Date.now();
    while (isLoading && Date.now() - start < timeoutMs) {
      await sleep(50);
    }
  }, [isLoading]);

  const ensureUserId = useCallback(async (): Promise<string> => {
    // If the app just navigated, hydration can lag slightly; wait for the initial auth snapshot.
    await waitForHydration();

    // Prefer the in-memory session (set by onAuthStateChange).
    if (session?.user?.id) return session.user.id;

    // Fast-path: read the persisted session directly (no network / no refresh_token call).
    // This avoids "Failed to fetch" (CORS/rede) issues that can happen during refresh.
    const stored = readStoredSession();
    if (isSessionLikelyValid(stored)) {
      setSession(stored);
      return stored.user.id;
    }

    // Last resort: ask the auth client. If this triggers a refresh_token request and it
    // fails due to network/CORS, we bubble the error so callers can soft-fail.
    const retryDelaysMs = [0, 120, 250, 500, 800];
    for (const delay of retryDelaysMs) {
      if (delay) await sleep(delay);
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        const msg = (error as any)?.message ?? String(error);
        if (/failed to fetch|network|fetch/i.test(msg)) {
          throw error;
        }
        console.warn("[auth] getSession error (ensureUserId):", error);
        continue;
      }
      if (data.session?.user?.id) {
        setSession(data.session);
        return data.session.user.id;
      }
    }

    throw new AuthRequiredError("AUTH_REQUIRED");
  }, [session, waitForHydration]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      user: session?.user ?? null,
      isLoading,
      refresh,
      ensureUserId,
    };
  }, [ensureUserId, isLoading, refresh, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}
