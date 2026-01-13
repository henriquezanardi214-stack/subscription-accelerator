import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Stepper } from "@/components/checkout/Stepper";
import { StepLead } from "@/components/checkout/StepLead";
import { StepQualification } from "@/components/checkout/StepQualification";
import { StepPayment, plans, PaymentData } from "@/components/checkout/StepPayment";
import { StepRegister } from "@/components/checkout/StepRegister";
import { StepCompanyForm, Socio, CompanyDocuments, createEmptySocio } from "@/components/checkout/StepCompanyForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const steps = [
  { title: "Seus dados", description: "Informações de contato" },
  { title: "Qualificação", description: "Sobre sua empresa" },
  { title: "Plano", description: "Escolha seu plano" },
  { title: "Cadastro", description: "Crie sua conta" },
  { title: "Abertura", description: "Dados da empresa" },
];

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 - Lead Data
  const [leadData, setLeadData] = useState({
    nome: "",
    email: "",
    telefone: "",
  });

  // Step 2 - Qualification Data
  const [qualificationData, setQualificationData] = useState({
    segmento: "",
    areaAtuacao: "",
    faturamento: "",
  });

  // Step 3 - Payment
  const [selectedPlan, setSelectedPlan] = useState("");

  // Step 5 - Company Form
  const [socios, setSocios] = useState<Socio[]>([createEmptySocio()]);
  const [iptu, setIptu] = useState("");
  const [hasEcpf, setHasEcpf] = useState(false);
  const [companyDocuments, setCompanyDocuments] = useState<CompanyDocuments>({});

  // Check user session and load resume data
  useEffect(() => {
    const checkUserAndLoadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If not logged in, show step 1
      if (!session?.user) {
        setIsLoadingResume(false);
        return;
      }

      // Check if user has a company_formation
      const { data: formation } = await supabase
        .from("company_formations")
        .select(`
          id,
          lead_id,
          iptu,
          has_ecpf,
          ecpf_certificate_url,
          leads (*),
          partners (*),
          documents:documents (*)
        `)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (formation) {
        const partners = formation.partners as { id: string }[] | null;
        
        // If partners exist, registration is complete - go to portal
        if (partners && partners.length > 0) {
          navigate("/acesso-portal");
          return;
        }

        // User has formation but no partners - load data and go to step 5
        const lead = formation.leads as { name: string; email: string; phone: string } | null;

        // Fetch qualification data
        const { data: qualification } = await supabase
          .from("qualifications")
          .select("*")
          .eq("lead_id", formation.lead_id)
          .maybeSingle();

        setLeadId(formation.lead_id);
        setLeadData({
          nome: lead?.name || "",
          email: lead?.email || "",
          telefone: lead?.phone || "",
        });
        setQualificationData({
          segmento: qualification?.company_segment || "",
          areaAtuacao: qualification?.area_of_operation || "",
          faturamento: qualification?.monthly_revenue || "",
        });
        setIptu(formation.iptu || "");
        setHasEcpf(formation.has_ecpf || false);
        setSocios([createEmptySocio()]);
        setCurrentStep(5);
      }

      setIsLoadingResume(false);
    };

    checkUserAndLoadData();
  }, [navigate]);

  // Only skip registration step if user just completed it (from StepRegister's onNext)
  // Do NOT auto-skip based on session alone - the registration step is intentional

  const handleLeadSubmit = async () => {
    setIsLoading(true);
    try {
      // We generate the lead id client-side to avoid needing a SELECT right after INSERT.
      // Returning representations requires SELECT permission, which is intentionally restricted by RLS.
      const newLeadId = crypto.randomUUID();

      const { error } = await supabase
        .from("leads")
        .insert({
          id: newLeadId,
          name: leadData.nome,
          email: leadData.email,
          phone: leadData.telefone,
        });

      if (error) throw error;

      setLeadId(newLeadId);
      setCurrentStep(2);
    } catch (error) {
      console.error("Error saving lead:", error);
      toast({
        title: "Erro ao salvar dados",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQualificationSubmit = async (isQualified: boolean) => {
    if (!leadId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from("qualifications").insert({
        lead_id: leadId,
        company_segment: qualificationData.segmento,
        area_of_operation: qualificationData.areaAtuacao,
        monthly_revenue: qualificationData.faturamento,
        is_qualified: isQualified,
      });

      if (error) throw error;

      if (isQualified) {
        setCurrentStep(3);
      } else {
        navigate("/desqualificado");
      }
    } catch (error) {
      console.error("Error saving qualification:", error);
      toast({
        title: "Erro ao salvar dados",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handlePaymentNext = async (paymentData: PaymentData) => {
    setIsLoading(true);
    try {
      const selectedPlanData = plans.find((p) => p.id === selectedPlan);
      if (!selectedPlanData) throw new Error("Plano não selecionado");

      const requestBody: Record<string, unknown> = {
        customer: {
          name: leadData.nome,
          email: leadData.email,
          phone: leadData.telefone,
          cpfCnpj: paymentData.cpfCnpj || paymentData.cardHolderInfo?.cpf || "",
        },
        billingType: paymentData.paymentMethod,
        planId: selectedPlan,
        planValue: selectedPlanData.price,
        remoteIp: "0.0.0.0",
      };

      if (paymentData.paymentMethod === "CREDIT_CARD" && paymentData.creditCard && paymentData.cardHolderInfo) {
        requestBody.creditCard = {
          holderName: paymentData.creditCard.holderName,
          number: paymentData.creditCard.number,
          expiryMonth: paymentData.creditCard.expiryMonth,
          expiryYear: paymentData.creditCard.expiryYear,
          ccv: paymentData.creditCard.ccv,
        };
        requestBody.creditCardHolderInfo = {
          name: paymentData.creditCard.holderName,
          email: leadData.email,
          cpfCnpj: paymentData.cardHolderInfo.cpf,
          postalCode: paymentData.cardHolderInfo.postalCode,
          addressNumber: paymentData.cardHolderInfo.addressNumber,
          phone: leadData.telefone,
        };
      }

      const response = await supabase.functions.invoke("create-subscription", {
        body: requestBody,
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao processar pagamento");
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || "Erro ao processar pagamento");
      }

      if (leadId) {
        // Get user ID for the subscription
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error: subError } = await supabase.from("subscriptions").insert({
          lead_id: leadId,
          user_id: user?.id || null, // Include user_id for RLS
          asaas_customer_id: data.customerId,
          asaas_subscription_id: data.subscriptionId,
          billing_type: paymentData.paymentMethod,
          status: data.status || "ACTIVE",
          plan_value: selectedPlanData.price,
          plan_name: selectedPlanData.name,
          bank_slip_url: data.bankSlipUrl || null,
          pix_qr_code_url: data.pixQrCodeUrl || null,
        });

        if (subError) {
          console.error("Error saving subscription:", subError);
        }
      }

      const successMessage = paymentData.paymentMethod === "CREDIT_CARD" 
        ? "Sua assinatura foi criada com sucesso."
        : paymentData.paymentMethod === "BOLETO"
          ? "Boleto gerado! Verifique seu e-mail."
          : "QR Code PIX gerado! Verifique seu e-mail.";

      toast({
        title: paymentData.paymentMethod === "CREDIT_CARD" ? "Pagamento aprovado!" : "Cobrança criada!",
        description: successMessage,
      });

      setCurrentStep(4);
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Erro no pagamento",
        description: error instanceof Error ? error.message : "Erro ao processar pagamento.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterNext = () => {
    setCurrentStep(5);
  };

  const handleSubmit = async (needsBiometria: boolean) => {
    if (!leadId) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Generate IDs client-side to avoid needing SELECT after INSERT
      const formationId = crypto.randomUUID();

      // Create company formation record
      const { error: formationError } = await supabase
        .from("company_formations")
        .insert({
          id: formationId,
          lead_id: leadId,
          iptu: iptu,
          has_ecpf: hasEcpf,
          ecpf_certificate_url: companyDocuments.ecpf_url || null,
          user_id: user?.id || null,
        });

      if (formationError) throw formationError;

      // Generate partner IDs client-side
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

      if (needsBiometria) {
        navigate("/biometria");
      } else {
        navigate("/sucesso");
      }
    } catch (error) {
      console.error("Error saving company data:", error);
      toast({
        title: "Erro ao salvar dados",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingResume) {
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
            Abra sua empresa
          </h1>
          <p className="text-muted-foreground">
            Complete o cadastro para começar
          </p>
        </div>

        {/* Stepper */}
        <Stepper currentStep={currentStep} steps={steps} />

        {/* Form Container */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl shadow-elegant p-6 sm:p-8">
            {currentStep === 1 && (
              <StepLead
                data={leadData}
                onUpdate={setLeadData}
                onNext={handleLeadSubmit}
                isLoading={isLoading}
              />
            )}

            {currentStep === 2 && (
              <StepQualification
                data={qualificationData}
                onUpdate={setQualificationData}
                onSubmit={handleQualificationSubmit}
                onBack={handleBack}
                isLoading={isLoading}
              />
            )}

            {currentStep === 3 && (
              <StepPayment
                selectedPlan={selectedPlan}
                onSelectPlan={setSelectedPlan}
                onNext={handlePaymentNext}
                onBack={handleBack}
                isLoading={isLoading}
              />
            )}

            {currentStep === 4 && (
              <StepRegister
                email={leadData.email}
                onBack={handleBack}
                onNext={handleRegisterNext}
                isLoading={isLoading}
              />
            )}

            {currentStep === 5 && (
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
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
