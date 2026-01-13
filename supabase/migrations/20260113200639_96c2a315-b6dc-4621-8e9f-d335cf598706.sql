-- Restrict storage uploads to validate file paths using regex

-- Drop the current permissive policy
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;

-- Create a new policy that validates path structure
-- Only allows uploads matching: documentType/uuid.extension
CREATE POLICY "Users can upload to valid document paths"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  -- Enforce path structure: documentType/uuid.ext
  -- Allowed document types: rg, cnh, iptu_capa, avcb, ecpf
  -- Allowed extensions: pdf, jpg, jpeg, png, webp
  name ~ '^(rg|cnh|iptu_capa|avcb|ecpf)/[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|webp)$'
);