import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthRequiredError } from "@/lib/auth";

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
        return;
      }

      // After initialization, keep loading=false for subsequent events.
      if (initializedRef.current) {
        setIsLoading(false);
      }
    });

    // Safety net: if INITIAL_SESSION event doesn't fire for any reason.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("[auth] getSession error:", error);
      }
      setSession(data.session);
      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsLoading(false);
      }
    });

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

    // Read directly from persisted session
    const { data: first, error: firstErr } = await supabase.auth.getSession();
    if (firstErr) console.warn("[auth] getSession error (ensureUserId):", firstErr);
    if (first.session?.user?.id) return first.session.user.id;

    // Only call /user or refresh if we actually have tokens to work with.
    const tokenSource = first.session ?? session;

    // Fallback: if there is an access token but the session snapshot is stale, /user can still work.
    if (tokenSource?.access_token) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!userErr && userData.user?.id) return userData.user.id;
      if (userErr) console.warn("[auth] getUser error (ensureUserId):", userErr);
    }

    // Last resort: refresh tokens (covers long forms / token expiry)
    if (tokenSource?.refresh_token) {
      const refreshed = await refresh();
      if (refreshed?.user?.id) return refreshed.user.id;

      const { data: last, error: lastErr } = await supabase.auth.getSession();
      if (lastErr) console.warn("[auth] getSession error after refresh (ensureUserId):", lastErr);
      if (last.session?.user?.id) return last.session.user.id;
    }

    const detail = firstErr?.message ?? "AUTH_REQUIRED";
    throw new AuthRequiredError(detail);
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
