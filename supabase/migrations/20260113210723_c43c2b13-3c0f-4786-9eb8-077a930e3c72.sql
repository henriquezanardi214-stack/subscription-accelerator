-- Fix qualifications INSERT RLS: avoid querying leads table under RLS
-- Create a SECURITY DEFINER function to check existence of a lead ID
CREATE OR REPLACE FUNCTION public.lead_exists(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE id = _lead_id
  );
$$;

-- Replace policy to use the security definer function (prevents RLS from blocking the EXISTS)
DROP POLICY IF EXISTS "Allow insert on qualifications" ON public.qualifications;

CREATE POLICY "Allow insert on qualifications"
ON public.qualifications
FOR INSERT
TO anon, authenticated
WITH CHECK (public.lead_exists(lead_id));
