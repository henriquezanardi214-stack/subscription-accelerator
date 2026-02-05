import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isSessionValid, readStoredSession } from "@/lib/authStorage";

export class AuthRequiredError extends Error {
  constructor(message = "AUTH_REQUIRED") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  ensureUserId: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  // Prevent concurrent refreshSession calls (refresh token rotation can revoke tokens if raced)
  const refreshInFlightRef = useRef<Promise<Session | null> | null>(null);

  // Refs para evitar closures "stale" dentro de callbacks async (ex.: ensureUserId)
  const sessionRef = useRef<Session | null>(null);
  const isLoadingRef = useRef(true);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    let mounted = true;

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // On initial/signed_out, try storage fallback if newSession is null
      if (!newSession && (event === "INITIAL_SESSION" || event === "SIGNED_OUT")) {
        const stored = readStoredSession();
        if (isSessionValid(stored)) {
          // IMPORTANT: also hydrate supabase-js internal auth state,
          // otherwise database requests may still run unauthenticated.
          void supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          });

          setSession(stored);
          if (!initializedRef.current) {
            initializedRef.current = true;
            setIsLoading(false);
          }
          return;
        }
      }

      setSession(newSession);

      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsLoading(false);
      }
    });

    // Initial session check from storage (no network)
    const stored = readStoredSession();
    if (isSessionValid(stored)) {
      // IMPORTANT: hydrate supabase-js internal auth state as well
      void supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });

      setSession(stored);
      initializedRef.current = true;
      setIsLoading(false);
    } else {
      // Fallback to getSession (may trigger network)
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    sessionRef.current = null;
  }, []);

  const ensureUserId = useCallback(async (): Promise<string> => {
    // Espera a hidratação inicial do auth (sem depender de closures antigas)
    const waitMs = 3000;
    const start = Date.now();
    while (isLoadingRef.current && Date.now() - start < waitMs) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // Check in-memory session
    const inMemory = sessionRef.current;
    if (inMemory?.user?.id) {
      return inMemory.user.id;
    }

    // Check supabase-js session (may already be hydrated even if our state isn't)
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.user?.id) {
      setSession(current.session);
      sessionRef.current = current.session;
      return current.session.user.id;
    }

    const refreshOnce = async (refreshToken?: string): Promise<Session | null> => {
      if (!refreshInFlightRef.current) {
        refreshInFlightRef.current = (async () => {
          try {
            const { data, error } = refreshToken
              ? await supabase.auth.refreshSession({ refresh_token: refreshToken })
              : await supabase.auth.refreshSession();

            if (error) return null;
            if (data.session) {
              setSession(data.session);
              sessionRef.current = data.session;
            }
            return data.session ?? null;
          } catch {
            return null;
          } finally {
            refreshInFlightRef.current = null;
          }
        })();
      }

      return refreshInFlightRef.current;
    };

    // Check storage (no network)
    const stored = readStoredSession();
    const storedRefreshToken = stored?.refresh_token;

    if (isSessionValid(stored)) {
      // Hydrate supabase-js so subsequent DB calls are authenticated
      await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });

      setSession(stored);
      sessionRef.current = stored;
      return stored.user.id;
    }

    // If we have a stored (but expired) session, try to refresh using refresh_token.
    // This prevents false "Sessão expirada" when the access token expired while the user was filling Step 5.
    if (storedRefreshToken) {
      const refreshed = await refreshOnce(storedRefreshToken);
      if (refreshed?.user?.id) return refreshed.user.id;
    }

    // Last attempt: refresh using SDK storage (guarded by mutex)
    const refreshedAuto = await refreshOnce();
    if (refreshedAuto?.user?.id) return refreshedAuto.user.id;

    // Try getSession (may trigger network refresh)
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("fetch") || msg.includes("network")) {
        throw error; // Transiente, deixe o caller decidir
      }
    }

    if (data.session?.user?.id) {
      setSession(data.session);
      sessionRef.current = data.session;
      return data.session.user.id;
    }

    throw new AuthRequiredError();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signOut,
      ensureUserId,
    }),
    [session, isLoading, signOut, ensureUserId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}
