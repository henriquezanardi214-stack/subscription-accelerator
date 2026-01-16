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
let refreshInFlight: Promise<void> | null = null;

async function refreshSessionSingleFlight(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  await refreshInFlight;
}

export async function requireUserId(): Promise<string> {
  const readFromSession = async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.user?.id ?? null;
  };

  const retryDelaysMs = [0, 120, 250, 500, 800];

  // Pass 1: wait for hydration
  for (const delay of retryDelaysMs) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const userId = await readFromSession();
    if (userId) return userId;
  }

  // Pass 2: attempt a refresh (covers long forms / token expiry)
  try {
    await refreshSessionSingleFlight();
  } catch {
    // ignore and fallthrough to final retry + error
  }

  for (const delay of retryDelaysMs) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const userId = await readFromSession();
    if (userId) return userId;
  }

  throw new AuthRequiredError();
}



