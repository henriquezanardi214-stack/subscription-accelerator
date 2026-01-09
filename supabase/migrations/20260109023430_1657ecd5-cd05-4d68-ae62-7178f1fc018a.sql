-- Add new columns to partners table for marital status and birthplace
ALTER TABLE public.partners 
ADD COLUMN marital_status text,
ADD COLUMN birthplace_city text,
ADD COLUMN birthplace_state text;

-- Add e-CPF fields to company_formations table
ALTER TABLE public.company_formations
ADD COLUMN has_ecpf boolean DEFAULT false,
ADD COLUMN ecpf_certificate_url text,
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create documents table for tracking uploaded files
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_formation_id uuid REFERENCES public.company_formations(id) ON DELETE CASCADE NOT NULL,
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own documents
CREATE POLICY "Users can insert own documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to view their own documents
CREATE POLICY "Users can view own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_formations cf
    WHERE cf.id = documents.company_formation_id
    AND cf.user_id = auth.uid()
  )
);

-- Allow admins to view all documents
CREATE POLICY "Admins can view all documents"
ON public.documents
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for documents bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view own documents in storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Admins can view all documents in storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Update company_formations policies to allow users to update their own
CREATE POLICY "Users can update own company_formations"
ON public.company_formations
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Update partners policy to allow insert for authenticated users
CREATE POLICY "Authenticated users can insert partners"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (true);