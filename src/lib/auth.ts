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

  // Session hydration can lag behind route navigation (especially right after sign-in).
  // We retry for ~1.5s before considering the user unauthenticated.
  const retryDelaysMs = [0, 100, 200, 400, 800];

  for (const delay of retryDelaysMs) {
    if (delay) await new Promise((r) => setTimeout(r, delay));

    const userId = await readFromSession();
    if (userId) return userId;
  }

  throw new AuthRequiredError();
}



