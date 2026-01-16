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
 * 1) Read local session
 * 2) Attempt refreshSession (fixes intermittent "missing sub"/expired access tokens)
 * 3) Fallback to getUser()
 */
export async function requireUserId(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  const sessionUserId = sessionData.session?.user?.id;
  if (sessionUserId) return sessionUserId;

  // Attempt to refresh session (may recreate access_token from refresh_token)
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

  const refreshedUserId = refreshData.session?.user?.id;
  if (refreshedUserId) return refreshedUserId;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userId) return userId;

  // Prefer the most actionable error
  const err = userError ?? refreshError ?? sessionError;
  if (err) {
    throw err;
  }

  throw new AuthRequiredError();
}
