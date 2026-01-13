-- Drop existing restrictive policies on storage.objects for documents bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to documents bucket" ON storage.objects;

-- Create permissive upload policy for documents bucket (any file format)
CREATE POLICY "Allow uploads to documents bucket"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'documents');

-- Create policy for reading documents
CREATE POLICY "Allow read access to documents bucket"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'documents');

-- Create policy for updating documents
CREATE POLICY "Allow update access to documents bucket"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'documents');

-- Create policy for deleting documents
CREATE POLICY "Allow delete access to documents bucket"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'documents');