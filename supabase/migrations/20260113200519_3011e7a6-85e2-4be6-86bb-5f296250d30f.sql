-- Fix overly permissive INSERT policies

-- 1. PARTNERS: Remove duplicate/permissive policies and add ownership check
DROP POLICY IF EXISTS "Allow public insert on partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON public.partners;

CREATE POLICY "Users can insert partners for own formations" ON public.partners
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_formations cf
    WHERE cf.id = company_formation_id
    AND cf.user_id = auth.uid()
  )
);

-- 2. DOCUMENTS: Fix insert policy to verify ownership
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;

CREATE POLICY "Users can insert documents for own formations" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_formations cf
    WHERE cf.id = company_formation_id
    AND cf.user_id = auth.uid()
  )
);

-- 3. SUBSCRIPTIONS: Restrict to authenticated users inserting their own subscriptions
DROP POLICY IF EXISTS "Allow public insert on subscriptions" ON public.subscriptions;

CREATE POLICY "Authenticated users can insert own subscriptions" ON public.subscriptions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. COMPANY_FORMATIONS: Restrict to authenticated users setting their own user_id
DROP POLICY IF EXISTS "Allow public insert on company_formations" ON public.company_formations;

CREATE POLICY "Authenticated users can insert own company_formations" ON public.company_formations
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5. QUALIFICATIONS: Keep public insert but add rate limiting comment
-- Note: This requires public access for the registration flow
-- Consider implementing rate limiting via Edge Function middleware
DROP POLICY IF EXISTS "Allow public insert on qualifications" ON public.qualifications;

CREATE POLICY "Allow insert on qualifications" ON public.qualifications
FOR INSERT TO anon, authenticated
WITH CHECK (
  -- Verify the lead_id exists to prevent orphan records
  EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id
  )
);

-- 6. LEADS: Keep public insert with a comment about rate limiting
-- Note: This is the entry point and requires public access
-- Implement rate limiting and CAPTCHA at the application layer
DROP POLICY IF EXISTS "Allow public insert on leads" ON public.leads;