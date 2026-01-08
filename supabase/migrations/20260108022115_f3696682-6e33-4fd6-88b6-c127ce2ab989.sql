-- Create subscriptions table for payment tracking
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  asaas_customer_id text NOT NULL,
  asaas_subscription_id text NOT NULL,
  billing_type text NOT NULL,
  status text NOT NULL,
  plan_value numeric(10,2) NOT NULL,
  plan_name text,
  bank_slip_url text,
  pix_qr_code_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow public insert (from edge function)
CREATE POLICY "Allow public insert on subscriptions"
ON public.subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access on subscriptions"
ON public.subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);