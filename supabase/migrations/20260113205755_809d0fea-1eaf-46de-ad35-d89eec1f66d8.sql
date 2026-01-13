-- Grant INSERT permission on leads table to anon and authenticated roles
GRANT INSERT ON public.leads TO anon, authenticated;

-- Also ensure SELECT is granted for the policies to work
GRANT SELECT ON public.leads TO anon, authenticated;