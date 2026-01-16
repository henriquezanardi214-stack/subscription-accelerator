import React, { useEffect, useRef, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function isTransientAuthNetworkError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network|fetch/i.test(msg);
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, ensureUserId } = useAuth();
  const location = useLocation();

  const attemptedRef = useRef(false);
  const [rehydrating, setRehydrating] = useState(false);
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    // Reset allow if user is present (fresh login/logout cycles)
    if (user) {
      setAllow(true);
      attemptedRef.current = false;
      return;
    }

    setAllow(false);

    if (isLoading) return;
    if (attemptedRef.current) return;

    attemptedRef.current = true;
    setRehydrating(true);

    (async () => {
      try {
        // Give the auth client a moment to hydrate/persist after login navigation.
        await ensureUserId();
        setAllow(true);
      } catch (err) {
        // If this is a transient network/CORS failure on refresh_token,
        // we do NOT want to hard-bounce the user to /login.
        if (isTransientAuthNetworkError(err)) {
          console.warn("[auth] transient auth network error during route guard:", err);
          setAllow(true);
          return;
        }

        setAllow(false);
      } finally {
        setRehydrating(false);
      }
    })();
  }, [ensureUserId, isLoading, user]);

  if (isLoading || rehydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !allow) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

