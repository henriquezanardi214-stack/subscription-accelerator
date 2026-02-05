
# Plan: Add Diagnostic Mode to Step 5 & Fix "Sessão Expirada" Issue

## Investigation Summary

After reviewing the codebase, logs, and database:

### Current State
- **Company formations ARE being saved successfully** - 7 records exist in the database with proper `user_id` and partners
- **No RLS violations in database logs** - No PostgreSQL errors related to company_formations
- **Auth system has multiple fallbacks** - The `AuthProvider.ensureUserId()` includes storage fallback, session refresh, and getSession attempts

### Root Causes of "Sessão Expirada" Error

1. **Token Expiration During Form Filling**
   - Supabase access tokens typically expire after 1 hour
   - If a user spends >1 hour filling Step 5 form (complex form with multiple partners, document uploads), the token expires
   - When `handleSubmit` is called, `auth.ensureUserId()` fails because:
     - The stored access_token is expired
     - The refresh_token might also be stale
     - Network issues prevent successful token refresh

2. **Race Condition in Auth Hydration**
   - On page load/refresh, there's a brief window where `auth.isLoading = true`
   - If user clicks submit during this window, `ensureUserId()` might not have completed auth hydration from localStorage
   - The current implementation in `Index.tsx` tries to call `auth.ensureUserId()` but doesn't wait for initial hydration

3. **Silent Session Expiry**
   - Users don't know their session is expiring while filling the form
   - No warning before the token expires
   - Only discover the issue when clicking "Finalizar cadastro"

## Solution: Two-Part Approach

### Part 1: Admin Diagnostic Mode (Immediate)

Add a collapsible diagnostic panel in Step 5 that shows (admin-only):
- **Session Status**: Valid ✅ / Expired ⚠️ / No Session ❌
- **User ID**: Current authenticated user ID
- **Token Expiration**: Time remaining until access_token expires
- **Admin Status**: Whether current user is an admin
- **Last Refresh**: When the session was last refreshed
- **Auth State**: Current auth loading state

This panel will:
- Auto-refresh every 10 seconds
- Show real-time session health
- Allow admins to identify exactly when/why sessions expire
- Be collapsible to not interfere with normal form usage

### Part 2: Proactive Session Management (Recommended)

Fix the underlying issue by:
- **Auto-refresh tokens** before they expire (at 50 minutes mark)
- **Show expiry warnings** when token will expire in <10 minutes
- **Block form submission** if session is invalid, with clear message to re-login
- **Improve auth hydration** by ensuring `ensureUserId()` waits for initial auth load

## Implementation Plan

### Step 1: Create Diagnostic Component (`src/components/checkout/SessionDiagnostics.tsx`)

```typescript
interface SessionDiagnostics {
  - Check if current user is admin (query user_roles table)
  - If not admin, return null (don't render)
  - If admin, show collapsible Accordion with:
    * Session validity check
    * User ID display
    * Token expiration countdown
    * Last refresh timestamp
    * Real-time updates (useEffect with 10s interval)
}
```

**Key Features:**
- Use `supabase.auth.getSession()` to read current session
- Parse `expires_at` from session to show countdown
- Use `supabase.from("user_roles")` to verify admin status
- Styled with existing shadcn components (Accordion, Badge, Card)
- Shows warning colors when token expires in <10 minutes

### Step 2: Integrate into StepCompanyForm

Add the diagnostic component at the top of the form (after the header):
```tsx
<SessionDiagnostics />
```

This will automatically:
- Check if user is admin
- Show diagnostic panel if admin
- Hide completely if not admin

### Step 3: Enhance Auth Hydration in Index.tsx

Update the `handleSubmit` function to:
```typescript
// Wait for auth to finish initial loading
while (auth.isLoading) {
  await new Promise(r => setTimeout(r, 100));
}

// Then call ensureUserId()
try {
  await auth.ensureUserId();
} catch {
  // Show "Sessão expirada" error
}
```

This prevents race conditions where submit is clicked before auth hydrates.

### Step 4: Add Proactive Token Refresh (Optional but Recommended)

Add a `useEffect` in `Index.tsx` that:
- Runs when `currentStep === 5`
- Checks token expiration every 5 minutes
- If expires in <10 minutes, attempts refresh
- If refresh fails, shows warning toast
- If expires in <2 minutes, shows modal requiring re-login

### Step 5: Add Session Expiry Warning

Show a persistent banner in Step 5 when:
- Token will expire in <10 minutes
- User should save progress and re-login
- Links to Step 4 (login/register)

## Technical Details

### Admin Check Pattern
```typescript
const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    setIsAdmin(!!data);
  };
  checkAdmin();
}, []);
```

### Session Status Display
```typescript
const getSessionStatus = (session: Session | null) => {
  if (!session) return { status: 'none', color: 'destructive' };
  
  const expiresAt = session.expires_at;
  if (!expiresAt) return { status: 'valid', color: 'default' };
  
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = expiresAt - now;
  
  if (timeLeft < 0) return { status: 'expired', color: 'destructive' };
  if (timeLeft < 600) return { status: 'expiring', color: 'warning' };
  return { status: 'valid', color: 'success' };
};
```

### Token Expiration Countdown
```typescript
const formatTimeRemaining = (expiresAt: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const seconds = expiresAt - now;
  
  if (seconds < 0) return 'Expirado';
  
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${seconds % 60}s`;
};
```

## Files to Create/Modify

### Create:
1. **src/components/checkout/SessionDiagnostics.tsx** - New diagnostic component

### Modify:
1. **src/components/checkout/StepCompanyForm.tsx** - Add `<SessionDiagnostics />` import and render
2. **src/pages/Index.tsx** - Improve `handleSubmit` auth hydration wait logic
3. (Optional) **src/pages/Index.tsx** - Add proactive token refresh useEffect

## Why This Error Happens

Based on code analysis:

1. **Long Form Fill Time**: Step 5 has complex form with multiple partners, multiple document uploads (RG, CNH, IPTU, AVCB, e-CPF). Users can easily spend 30-60+ minutes filling this.

2. **No Proactive Refresh**: The current implementation only refreshes tokens when operations fail. There's no proactive refresh before expiry.

3. **Silent Expiration**: Users get no warning their session is expiring while filling the form.

4. **Late Validation**: Session validity is only checked in `handleSubmit`, not during form filling.

5. **Storage Issues**: Some browsers aggressively clear localStorage, especially in private/incognito mode.

## Expected Outcome

After implementation:

### For Admins (Diagnostic Mode):
- Clear visibility into session health while testing
- Ability to see exact moment session expires
- Real-time monitoring of auth state
- Helps debug user reports of "Sessão expirada"

### For All Users (Enhanced Session Management):
- Auto-refresh tokens before expiry
- Clear warnings when session will expire soon
- Better error messages with actionable steps
- Reduced "Sessão expirada" errors

### Success Metrics:
- Admins can see session diagnostics in Step 5
- Session status updates in real-time
- "Sessão expirada" errors reduced by proactive refresh
- Users warned before session expires

## Alternative Approaches Considered

1. **Server-side session extension**: Not possible with Supabase client-side auth
2. **localStorage persistence without expiry**: Security risk, violates OAuth2 spec
3. **Periodic full re-authentication**: Poor UX, loses form progress
4. **Cookies instead of localStorage**: Doesn't solve token expiry issue

## Security Considerations

- Diagnostic panel only visible to admins (verified via `user_roles` table)
- No sensitive token values displayed (only expiry times)
- Session refresh follows Supabase best practices
- Admin check uses RLS-protected table query
