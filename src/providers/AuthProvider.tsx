import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthRequiredError } from "@/lib/auth";
import { readSessionBackup, readStoredSession, writeSessionBackup } from "@/lib/authStorage";

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

const isTransientAuthNetworkError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network|fetch/i.test(msg);
};

/**
 * NOTE: This must NOT be a TypeScript type-guard.
 *
 * We intentionally want to keep access to potentially-expired sessions (still shaped like Session)
 * so we can attempt refresh flows without TS narrowing the value to `null`.
 */
const isSessionLikelyValid = (s: Session | null): boolean => {
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

    // Prefer letting the auth client auto-refresh in the background.
    // The intermittent issues we saw were largely caused by not being able to read
    // the stored session (storageKey resolution), forcing network refresh at the worst time.
    (supabase.auth as any).startAutoRefresh?.();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      log("event", "onAuthStateChange", event, {
        userId: nextSession?.user?.id,
        expiresAt: (nextSession as any)?.expires_at,
      });

      if (nextSession) {
        writeSessionBackup(nextSession);
      }

      // If hydration produced no session (or an unexpected SIGNED_OUT), try to recover.
      if (!nextSession && (event === "INITIAL_SESSION" || event === "SIGNED_OUT")) {
        const stored = readStoredSession();
        log("storage", "AuthProvider", "Read supabase storage session", {
          hasSession: !!stored,
          userId: stored?.user?.id,
          expiresAt: (stored as any)?.expires_at,
        });

        if (stored && isSessionLikelyValid(stored)) {
          log("decision", "AuthProvider", "Keeping storage session", { userId: stored.user.id });
          setSession(stored);
          if (!initializedRef.current) initializedRef.current = true;
          setIsLoading(false);
          return;
        }

        // Fallback: if the auth client cleared its own key, recover from backup.
        const backup = readSessionBackup();
        log("storage", "AuthProvider", "Read backup session", {
          hasSession: !!backup,
          userId: backup?.user?.id,
          expiresAt: (backup as any)?.expires_at,
        });

        if (backup && isSessionLikelyValid(backup)) {
          log("decision", "AuthProvider", "Restored session from backup", { userId: backup.user.id });
          setSession(backup);
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

    // Boot: prefer storage read, then fall back to getSession.
    const storedOnBoot = readStoredSession();
    log("storage", "AuthProvider", "Boot storage read", {
      hasSession: !!storedOnBoot,
      userId: storedOnBoot?.user?.id,
      expiresAt: (storedOnBoot as any)?.expires_at,
    });

    if (storedOnBoot && isSessionLikelyValid(storedOnBoot)) {
      setSession(storedOnBoot);
      writeSessionBackup(storedOnBoot);
      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsLoading(false);
      }
    } else {
      supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          log("error", "AuthProvider", "getSession error (boot)", {
            message: (error as any)?.message ?? String(error),
          });
        } else if (data.session) {
          writeSessionBackup(data.session);
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
        log("info", "AuthProvider", "refreshSession() called");

        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          log("error", "AuthProvider", "refreshSession() error", {
            message: (error as any)?.message ?? String(error),
          });
          return null;
        }

        if (data.session) {
          writeSessionBackup(data.session);
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
    await waitForHydration();

    // Prefer in-memory session.
    if (session?.user?.id) return session.user.id;

    // Prefer persisted session (no network).
    const stored = readStoredSession();
    log("storage", "ensureUserId", "Read supabase storage session", {
      hasSession: !!stored,
      userId: stored?.user?.id,
      expiresAt: (stored as any)?.expires_at,
    });

    if (stored && isSessionLikelyValid(stored)) {
      setSession(stored);
      return stored.user.id;
    }

    // If we have a stored session but it's expired-ish, try a refresh first.
    if (stored?.user?.id && stored?.refresh_token) {
      log("decision", "ensureUserId", "Stored session not valid; attempting refreshSession()", {
        userId: stored.user.id,
        expiresAt: (stored as any)?.expires_at,
      });

      const retryDelaysMs = [0, 250, 500, 900];
      for (const delay of retryDelaysMs) {
        if (delay) await sleep(delay);
        try {
          const refreshed = await refresh();
          if (refreshed?.user?.id) return refreshed.user.id;
        } catch (err) {
          if (isTransientAuthNetworkError(err)) throw err;
        }
      }
    }

    // Fallback: backup session.
    const backup = readSessionBackup();
    log("storage", "ensureUserId", "Read backup session", {
      hasSession: !!backup,
      userId: backup?.user?.id,
      expiresAt: (backup as any)?.expires_at,
    });

    if (backup && isSessionLikelyValid(backup)) {
      setSession(backup);
      return backup.user.id;
    }

    // Last resort: ask the auth client (may hit network / refresh token).
    const retryDelaysMs = [0, 120, 250, 500, 800];
    for (const delay of retryDelaysMs) {
      if (delay) await sleep(delay);
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (isTransientAuthNetworkError(error)) {
          log("error", "ensureUserId", "getSession transient error", {
            message: (error as any)?.message ?? String(error),
          });
          throw error;
        }
        log("error", "ensureUserId", "getSession error", {
          message: (error as any)?.message ?? String(error),
        });
        continue;
      }

      if (data.session?.user?.id) {
        writeSessionBackup(data.session);
        setSession(data.session);
        return data.session.user.id;
      }
    }

    throw new AuthRequiredError("AUTH_REQUIRED");
  }, [refresh, session, waitForHydration]);

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
