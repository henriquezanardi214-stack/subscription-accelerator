import React, { useEffect, useRef, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { pushAuthLog } from "@/components/debug/AuthDebugPanel";

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
    pushAuthLog("info", "ProtectedRoute", `Effect run`, { path: location.pathname, hasUser: !!user, isLoading });

    // Reset allow if user is present (fresh login/logout cycles)
    if (user) {
      pushAuthLog("decision", "ProtectedRoute", "User present, allowing", { userId: user.id });
      setAllow(true);
      attemptedRef.current = false;
      return;
    }

    setAllow(false);

    if (isLoading) {
      pushAuthLog("info", "ProtectedRoute", "Still loading, waiting...");
      return;
    }
    if (attemptedRef.current) return;

    attemptedRef.current = true;
    setRehydrating(true);

    (async () => {
      try {
        pushAuthLog("info", "ProtectedRoute", "Calling ensureUserId()...");
        const userId = await ensureUserId();
        pushAuthLog("decision", "ProtectedRoute", "ensureUserId() succeeded", { userId });
        setAllow(true);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        pushAuthLog("error", "ProtectedRoute", `ensureUserId() failed: ${detail}`);

        // If this is a transient network/CORS failure on refresh_token,
        // we do NOT want to hard-bounce the user to /login.
        if (isTransientAuthNetworkError(err)) {
          pushAuthLog("decision", "ProtectedRoute", "Transient network error, allowing anyway");
          console.warn("[auth] transient auth network error during route guard:", err);
          setAllow(true);
          return;
        }

        pushAuthLog("decision", "ProtectedRoute", "Auth required, denying access");
        setAllow(false);
      } finally {
        setRehydrating(false);
      }
    })();
  }, [ensureUserId, isLoading, user, location.pathname]);

  if (isLoading || rehydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !allow) {
    pushAuthLog("decision", "ProtectedRoute", "Redirecting to /login", { from: location.pathname });
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

