-- Explicitly deny anonymous access to profiles table to prevent email harvesting
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);