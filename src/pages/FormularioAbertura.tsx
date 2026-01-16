import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StepCompanyForm, Socio, CompanyDocuments, createEmptySocio } from "@/components/checkout/StepCompanyForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyFormationSubmit } from "@/hooks/useCompanyFormationSubmit";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const FormularioAbertura = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [formationId, setFormationId] = useState<string | null>(null);

  // Company Form State
  const [socios, setSocios] = useState<Socio[]>([createEmptySocio()]);
  const [iptu, setIptu] = useState("");
  const [hasEcpf, setHasEcpf] = useState(false);
  const [companyDocuments, setCompanyDocuments] = useState<CompanyDocuments>({});

  // Hook for submission
  const { isSubmitting, updateFormation } = useCompanyFormationSubmit({
    onSessionExpired: () => navigate("/login"),
  });

  // Load existing data once auth is hydrated
  useEffect(() => {
    const loadUserData = async () => {
      if (authLoading) return;
      if (!user) return; // ProtectedRoute handles redirect

      const userId = user.id;

      const { data: formation, error: formationError } = await supabase
        .from("company_formations")
        .select(`
          id,
          lead_id,
          iptu,
          has_ecpf,
          ecpf_certificate_url,
          partners (*),
          documents:documents (*)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (formationError) {
        console.error("Error fetching company formation (FormularioAbertura):", formationError);
      }

      if (formation) {
        setFormationId(formation.id);
        setIptu(formation.iptu || "");
        setHasEcpf(formation.has_ecpf || false);

        const documents = (formation.documents as any[] | null) ?? [];

        const partners = formation.partners as any[] | null;
        if (partners && partners.length > 0) {
          const loadedSocios: Socio[] = partners.map((partner: any) => {
            const partnerDocs = documents.filter((d) => d.partner_id === partner.id);
            const rgDoc = partnerDocs.find((d) => d.document_type === "rg");
            const cnhDoc = partnerDocs.find((d) => d.document_type === "cnh");

            return {
              id: partner.id,
              nome: partner.name || "",
              rg: partner.rg || "",
              cpf: partner.cpf || "",
              cep: partner.cep || "",
              endereco: partner.address || "",
              cidadeUf: partner.city_state || "",
              estadoCivil: partner.marital_status || "",
              naturalidadeCidade: partner.birthplace_city || "",
              naturalidadeEstado: partner.birthplace_state || "",
              documents: {
                rg_url: rgDoc?.file_url || "",
                rg_name: rgDoc?.file_name || "",
                cnh_url: cnhDoc?.file_url || "",
                cnh_name: cnhDoc?.file_name || "",
              },
            };
          });

          setSocios(loadedSocios);
        }

        if (documents.length > 0) {
          const newCompanyDocuments: CompanyDocuments = {};
          documents.forEach((doc: any) => {
            if (doc.document_type === "iptu_capa") {
              newCompanyDocuments.iptu_url = doc.file_url;
              newCompanyDocuments.iptu_name = doc.file_name;
            } else if (doc.document_type === "avcb") {
              newCompanyDocuments.avcb_url = doc.file_url;
              newCompanyDocuments.avcb_name = doc.file_name;
            } else if (doc.document_type === "ecpf") {
              newCompanyDocuments.ecpf_url = doc.file_url;
              newCompanyDocuments.ecpf_name = doc.file_name;
            }
          });
          setCompanyDocuments(newCompanyDocuments);
        }
      } else {
        toast({
          title: "Nenhum cadastro encontrado",
          description: "Complete as etapas anteriores primeiro.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsLoading(false);
    };

    loadUserData();
  }, [authLoading, navigate, toast, user]);

  const handleBack = () => {
    navigate("/acesso-portal");
  };

  /**
   * Submit handler - uses the extracted hook.
   * hasEcpfFromForm comes from the form (user's selection at submit time).
   */
  const handleSubmit = async (hasEcpfFromForm: boolean) => {
    if (!formationId) return;

    await updateFormation(
      {
        formationId,
        socios,
        iptu,
        hasEcpf,
        companyDocuments,
      },
      hasEcpfFromForm
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero">
      <div className="container max-w-5xl py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Editar dados da empresa
          </h1>
          <p className="text-muted-foreground">Atualize as informações do seu cadastro</p>
        </div>

        {/* Form Container */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl shadow-elegant p-6 sm:p-8">
            <StepCompanyForm
              socios={socios}
              iptu={iptu}
              hasEcpf={hasEcpf}
              companyDocuments={companyDocuments}
              onUpdateSocios={setSocios}
              onUpdateIptu={setIptu}
              onUpdateHasEcpf={setHasEcpf}
              onUpdateCompanyDocuments={setCompanyDocuments}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isLoading={isSubmitting || authLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormularioAbertura;
