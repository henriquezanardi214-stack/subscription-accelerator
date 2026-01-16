import { supabase } from "@/integrations/supabase/client";

export class AuthRequiredError extends Error {
  constructor(message = "AUTH_REQUIRED") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Returns the authenticated user's id.
 *
 * Strategy:
 * 1) Read local session (twice, with a tiny delay to allow hydration)
 * 2) Attempt a SINGLE-FLIGHT refreshSession (avoids refresh-token rotation race conditions)
 * 3) Fallback to getUser()
 */

let refreshInFlight: ReturnType<typeof supabase.auth.refreshSession> | null = null;

function refreshSessionSingleFlight() {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth.refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}


export async function requireUserId(): Promise<string> {
  // Diagnostic logs (do not print tokens)
  try {
    const authKeys = Object.keys(localStorage).filter(
      (k) => k.startsWith("sb-") || k.includes("supabase") || k.includes("auth")
    );
    console.info("[auth] requireUserId start", {
      origin: window.location.origin,
      path: window.location.pathname,
      authKeys,
    });
  } catch {
    // ignore
  }

  const { data: sessionData1, error: sessionError1 } = await supabase.auth.getSession();
  const sessionUserId1 = sessionData1.session?.user?.id;
  console.info("[auth] getSession #1", {
    hasSession: !!sessionData1.session,
    hasUser: !!sessionData1.session?.user,
    error: sessionError1 ? { name: sessionError1.name, message: sessionError1.message } : null,
  });
  if (sessionUserId1) return sessionUserId1;

  // Sometimes session hydration from storage lags a tick on navigation.
  await new Promise((r) => setTimeout(r, 50));

  const { data: sessionData2, error: sessionError2 } = await supabase.auth.getSession();
  const sessionUserId2 = sessionData2.session?.user?.id;
  console.info("[auth] getSession #2", {
    hasSession: !!sessionData2.session,
    hasUser: !!sessionData2.session?.user,
    error: sessionError2 ? { name: sessionError2.name, message: sessionError2.message } : null,
  });
  if (sessionUserId2) return sessionUserId2;

  // Attempt to refresh session (may recreate access_token from refresh_token)
  const { data: refreshData, error: refreshError } = await refreshSessionSingleFlight();
  console.info("[auth] refreshSession", {
    hasSession: !!refreshData.session,
    hasUser: !!refreshData.session?.user,
    error: refreshError ? { name: refreshError.name, message: refreshError.message } : null,
  });
  const refreshedUserId = refreshData.session?.user?.id;
  if (refreshedUserId) return refreshedUserId;

  // As a last resort, ask the server for the user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.info("[auth] getUser", {
    hasUser: !!userData.user,
    error: userError ? { name: userError.name, message: userError.message } : null,
  });
  const userId = userData.user?.id;
  if (userId) return userId;

  const err = userError ?? refreshError ?? sessionError2 ?? sessionError1;
  if (err) throw err;

  throw new AuthRequiredError();
}


