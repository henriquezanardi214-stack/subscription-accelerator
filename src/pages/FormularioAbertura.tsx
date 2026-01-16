import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StepCompanyForm, Socio, CompanyDocuments, createEmptySocio } from "@/components/checkout/StepCompanyForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const FormularioAbertura = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading, ensureUserId } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formationId, setFormationId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  // Company Form State
  const [socios, setSocios] = useState<Socio[]>([createEmptySocio()]);
  const [iptu, setIptu] = useState("");
  const [hasEcpf, setHasEcpf] = useState(false);
  const [companyDocuments, setCompanyDocuments] = useState<CompanyDocuments>({});

  // Load existing data once auth is hydrated
  useEffect(() => {
    const loadUserData = async () => {
      if (authLoading) return;
      if (!user) return; // ProtectedRoute handles redirect

      const userId = user.id;

      // Load existing company formation data (use the most recent one)
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
        setLeadId(formation.lead_id);
        setIptu(formation.iptu || "");
        setHasEcpf(formation.has_ecpf || false);

        // Load documents
        const documents = (formation.documents as any[] | null) ?? [];

        // Load partners (with partner documents)
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

        // Load company documents
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
        // No formation exists - redirect to home
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

  const handleSubmit = async (hasEcpfFromForm: boolean) => {
    if (!formationId || !leadId) return;

    setIsSubmitting(true);
    try {
      // Garante sessão válida (tenta refresh se necessário) antes de fazer operações no backend
      await ensureUserId();

      // Update company formation record
      const { error: formationError } = await supabase
        .from("company_formations")
        .update({
          iptu: iptu,
          has_ecpf: hasEcpf,
          ecpf_certificate_url: companyDocuments.ecpf_url || null,
        })
        .eq("id", formationId);

      if (formationError) throw formationError;

      // Delete existing partners and documents to re-insert
      await supabase.from("partners").delete().eq("company_formation_id", formationId);
      await supabase.from("documents").delete().eq("company_formation_id", formationId);

      // Generate partner IDs client-side to avoid needing SELECT after INSERT
      const partnersToInsert = socios.map((socio) => ({
        id: crypto.randomUUID(),
        company_formation_id: formationId,
        name: socio.nome,
        rg: socio.rg,
        cpf: socio.cpf.replace(/\D/g, ""),
        cep: socio.cep.replace(/\D/g, ""),
        address: socio.endereco,
        city_state: socio.cidadeUf,
        marital_status: socio.estadoCivil,
        birthplace_city: socio.naturalidadeCidade,
        birthplace_state: socio.naturalidadeEstado,
      }));

      const { error: partnersError } = await supabase
        .from("partners")
        .insert(partnersToInsert);

      if (partnersError) throw partnersError;

      // Save company documents
      const documentsToInsert = [];

      if (companyDocuments.iptu_url) {
        documentsToInsert.push({
          company_formation_id: formationId,
          document_type: "iptu_capa",
          file_name: companyDocuments.iptu_name || "iptu",
          file_url: companyDocuments.iptu_url,
        });
      }

      if (companyDocuments.avcb_url) {
        documentsToInsert.push({
          company_formation_id: formationId,
          document_type: "avcb",
          file_name: companyDocuments.avcb_name || "avcb",
          file_url: companyDocuments.avcb_url,
        });
      }

      // Save partner documents using the generated partner IDs
      for (let i = 0; i < socios.length; i++) {
        const socio = socios[i];
        const partnerId = partnersToInsert[i].id;

        if (socio.documents.rg_url) {
          documentsToInsert.push({
            company_formation_id: formationId,
            partner_id: partnerId,
            document_type: "rg",
            file_name: socio.documents.rg_name || "rg",
            file_url: socio.documents.rg_url,
          });
        }

        if (socio.documents.cnh_url) {
          documentsToInsert.push({
            company_formation_id: formationId,
            partner_id: partnerId,
            document_type: "cnh",
            file_name: socio.documents.cnh_name || "cnh",
            file_url: socio.documents.cnh_url,
          });
        }
      }

      if (documentsToInsert.length > 0) {
        const { error: docsError } = await supabase
          .from("documents")
          .insert(documentsToInsert);

        if (docsError) {
          console.error("Error saving documents:", docsError);
        }
      }

      toast({
        title: "Dados atualizados!",
        description: "Suas informações foram salvas com sucesso.",
      });

      if (hasEcpfFromForm) {
        navigate("/acesso-portal");
      } else {
        navigate("/biometria");
      }
    } catch (error) {
      console.error("Error saving company data:", error);
      toast({
        title: "Erro ao salvar dados",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
          <p className="text-muted-foreground">
            Atualize as informações do seu cadastro
          </p>
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

