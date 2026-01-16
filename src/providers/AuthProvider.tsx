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

    // Check storage
    const stored = readStoredSession();
    if (isSessionValid(stored)) {
      setSession(stored);
      sessionRef.current = stored;
      return stored.user.id;
    }

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
