import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, ensureUserId } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // If user is present, allow immediately
    if (user) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    // Still loading auth state
    if (isLoading) {
      return;
    }

    // No user after loading, try ensureUserId
    let mounted = true;
    (async () => {
      try {
        await ensureUserId();
        if (mounted) {
          setAllowed(true);
        }
      } catch {
        if (mounted) {
          setAllowed(false);
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, isLoading, ensureUserId]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !allowed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
