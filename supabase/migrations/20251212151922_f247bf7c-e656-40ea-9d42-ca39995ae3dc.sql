-- Tabela de Leads (Etapa 1)
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Qualificações (Etapa 2)
CREATE TABLE public.qualifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_segment TEXT NOT NULL,
  area_of_operation TEXT NOT NULL,
  monthly_revenue TEXT NOT NULL,
  is_qualified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Dados de Abertura de Empresa (Etapa 4)
CREATE TABLE public.company_formations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  iptu TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Sócios (relacionada à abertura de empresa)
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_formation_id UUID NOT NULL REFERENCES public.company_formations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rg TEXT NOT NULL,
  cpf TEXT NOT NULL,
  cep TEXT NOT NULL,
  address TEXT NOT NULL,
  city_state TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Políticas para inserção pública (checkout sem autenticação)
CREATE POLICY "Allow public insert on leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on qualifications" ON public.qualifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on company_formations" ON public.company_formations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on partners" ON public.partners FOR INSERT WITH CHECK (true);

-- Políticas para leitura (apenas para uso interno/admin futuro)
CREATE POLICY "Allow public read on leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Allow public read on qualifications" ON public.qualifications FOR SELECT USING (true);
CREATE POLICY "Allow public read on company_formations" ON public.company_formations FOR SELECT USING (true);
CREATE POLICY "Allow public read on partners" ON public.partners FOR SELECT USING (true);