import React, { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, ensureUserId } = useAuth();
  const location = useLocation();
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const attemptedRef = useRef(false);

  useEffect(() => {
    // If user is present, allow immediately
    if (user) {
      setAuthState("allowed");
      attemptedRef.current = false; // Reset for future checks
      return;
    }

    // Still loading auth state - wait
    if (isLoading) {
      return;
    }

    // Already attempted ensureUserId in this auth cycle
    if (attemptedRef.current) {
      return;
    }

    // No user after loading, try ensureUserId once
    let mounted = true;
    attemptedRef.current = true;

    (async () => {
      try {
        // Give AuthProvider a moment to hydrate after navigation
        await new Promise((r) => setTimeout(r, 100));
        
        await ensureUserId();
        if (mounted) {
          setAuthState("allowed");
        }
      } catch {
        if (mounted) {
          setAuthState("denied");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, isLoading, ensureUserId]);

  // Reset attempt flag when user becomes available
  useEffect(() => {
    if (user) {
      attemptedRef.current = false;
    }
  }, [user]);

  if (isLoading || authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && authState === "denied") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
