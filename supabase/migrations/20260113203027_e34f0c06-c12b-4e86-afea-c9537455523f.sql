-- Allow anonymous and authenticated users to insert leads (required for registration flow)
CREATE POLICY "Allow insert on leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);