-- ======================================================
-- SECURITY FIX: Remove overly permissive public read policies
-- ======================================================

-- 1. Drop public read policies on sensitive tables (keep admin-only access)
DROP POLICY IF EXISTS "Allow public read on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public read on qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Allow public read on company_formations" ON public.company_formations;
DROP POLICY IF EXISTS "Allow public read on partners" ON public.partners;

-- 2. Add user-scoped SELECT policies for authenticated users to access their own data
-- Users can view their own company formations
CREATE POLICY "Users can view own company_formations"
ON public.company_formations FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can view qualifications linked to their company formations
CREATE POLICY "Users can view own qualifications"
ON public.qualifications FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_formations cf
    WHERE cf.lead_id = qualifications.lead_id
    AND cf.user_id = auth.uid()
  )
);

-- Users can view partners linked to their company formations
CREATE POLICY "Users can view own partners"
ON public.partners FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_formations cf
    WHERE cf.id = partners.company_formation_id
    AND cf.user_id = auth.uid()
  )
);

-- Users can view leads linked to their company formations
CREATE POLICY "Users can view own leads"
ON public.leads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_formations cf
    WHERE cf.lead_id = leads.id
    AND cf.user_id = auth.uid()
  )
);

-- ======================================================
-- SECURITY FIX: Add user_id to subscriptions table and user-scoped access
-- ======================================================

-- Add user_id column to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Backfill existing subscriptions with user_id from company_formations
UPDATE public.subscriptions s
SET user_id = cf.user_id
FROM public.company_formations cf
WHERE cf.lead_id = s.lead_id
AND s.user_id IS NULL;

-- Add user-scoped SELECT policy for subscriptions
CREATE POLICY "Users can view own subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ======================================================
-- SECURITY FIX: Fix storage bucket policies for proper ownership
-- ======================================================

-- Drop the broken storage policy that allows cross-user access
DROP POLICY IF EXISTS "Users can view own documents in storage" ON storage.objects;

-- Create proper ownership-based storage policy
CREATE POLICY "Users can view own documents in storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Check if file belongs to user's company formation
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.company_formations cf ON cf.id = d.company_formation_id
      WHERE d.file_url LIKE '%' || storage.objects.name
      AND cf.user_id = auth.uid()
    )
    OR
    -- Allow admins
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Add DELETE policy for users to delete their own documents
CREATE POLICY "Users can delete own documents in storage"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.company_formations cf ON cf.id = d.company_formation_id
      WHERE d.file_url LIKE '%' || storage.objects.name
      AND cf.user_id = auth.uid()
    )
    OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Create index on documents.file_url for performance
CREATE INDEX IF NOT EXISTS idx_documents_file_url ON public.documents(file_url);

-- Create index on company_formations.user_id for performance
CREATE INDEX IF NOT EXISTS idx_company_formations_user_id ON public.company_formations(user_id);