import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Socio, CompanyDocuments, createEmptySocio } from "@/components/checkout/StepCompanyForm";

interface ResumeData {
  leadId: string | null;
  leadData: {
    nome: string;
    email: string;
    telefone: string;
  };
  qualificationData: {
    segmento: string;
    areaAtuacao: string;
    faturamento: string;
  };
  socios: Socio[];
  iptu: string;
  hasEcpf: boolean;
  companyDocuments: CompanyDocuments;
  currentStep: number;
}

export const useResumeRegistration = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);

  useEffect(() => {
    const checkResumeData = async () => {
      const resume = searchParams.get("resume");
      const formationId = searchParams.get("formation_id");

      if (resume !== "true" || !formationId) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch company formation with related data
        const { data: formation, error: formationError } = await supabase
          .from("company_formations")
          .select(`
            *,
            leads (*),
            partners (*)
          `)
          .eq("id", formationId)
          .single();

        if (formationError || !formation) {
          console.error("Error fetching formation:", formationError);
          setIsLoading(false);
          return;
        }

        // Fetch qualification data
        const { data: qualification } = await supabase
          .from("qualifications")
          .select("*")
          .eq("lead_id", formation.lead_id)
          .maybeSingle();

        // Fetch documents
        const { data: documents } = await supabase
          .from("documents")
          .select("*")
          .eq("company_formation_id", formationId);

        // Build socios array from partners
        const socios: Socio[] = (formation.partners || []).map((partner: {
          id: string;
          name: string;
          rg: string;
          cpf: string;
          cep: string;
          address: string;
          city_state: string;
          marital_status: string | null;
          birthplace_city: string | null;
          birthplace_state: string | null;
        }) => {
          const partnerDocs = documents?.filter((d) => d.partner_id === partner.id) || [];
          const rgDoc = partnerDocs.find((d) => d.document_type === "rg");
          const cnhDoc = partnerDocs.find((d) => d.document_type === "cnh");

          return {
            id: partner.id,
            nome: partner.name,
            rg: partner.rg,
            cpf: partner.cpf,
            cep: partner.cep,
            endereco: partner.address,
            cidadeUf: partner.city_state,
            estadoCivil: partner.marital_status || "",
            naturalidadeCidade: partner.birthplace_city || "",
            naturalidadeEstado: partner.birthplace_state || "",
            documents: {
              rg_url: rgDoc?.file_url || null,
              rg_name: rgDoc?.file_name || null,
              cnh_url: cnhDoc?.file_url || null,
              cnh_name: cnhDoc?.file_name || null,
            },
          };
        });

        // Build company documents
        const iptuDoc = documents?.find((d) => d.document_type === "iptu_capa");
        const avcbDoc = documents?.find((d) => d.document_type === "avcb");
        const ecpfDoc = documents?.find((d) => d.document_type === "ecpf");

        const companyDocuments: CompanyDocuments = {
          iptu_url: iptuDoc?.file_url || null,
          iptu_name: iptuDoc?.file_name || null,
          avcb_url: avcbDoc?.file_url || null,
          avcb_name: avcbDoc?.file_name || null,
          ecpf_url: ecpfDoc?.file_url || null,
          ecpf_name: ecpfDoc?.file_name || null,
        };

        const lead = formation.leads as { name: string; email: string; phone: string } | null;

        setResumeData({
          leadId: formation.lead_id,
          leadData: {
            nome: lead?.name || "",
            email: lead?.email || "",
            telefone: lead?.phone || "",
          },
          qualificationData: {
            segmento: qualification?.company_segment || "",
            areaAtuacao: qualification?.area_of_operation || "",
            faturamento: qualification?.monthly_revenue || "",
          },
          socios: socios.length > 0 ? socios : [createEmptySocio()],
          iptu: formation.iptu || "",
          hasEcpf: formation.has_ecpf || false,
          companyDocuments,
          currentStep: 5, // Go directly to company form step
        });
      } catch (error) {
        console.error("Error loading resume data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkResumeData();
  }, [searchParams]);

  return { isLoading, resumeData };
};
