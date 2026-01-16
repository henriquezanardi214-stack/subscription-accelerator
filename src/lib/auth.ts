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
 * IMPORTANT:
 * - This helper must be STABLE.
 * - We purposely avoid forcing refreshSession()/getUser() here because those calls can
 *   clear local auth state when tokens are in a transient/rotating state.
 * - If the session isn't hydrated yet, we retry once after a short delay.
 */
export async function requireUserId(): Promise<string> {
  const readFromSession = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.user?.id ?? null;
  };

  const userId1 = await readFromSession();
  if (userId1) return userId1;

  // Sometimes session hydration from storage lags a tick on navigation.
  await new Promise((r) => setTimeout(r, 80));

  const userId2 = await readFromSession();
  if (userId2) return userId2;

  throw new AuthRequiredError();
}



