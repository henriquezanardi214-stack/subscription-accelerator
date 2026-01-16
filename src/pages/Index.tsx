import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "@/components/checkout/Stepper";
import { StepLead } from "@/components/checkout/StepLead";
import { StepQualification } from "@/components/checkout/StepQualification";
import { StepPayment, plans, PaymentData } from "@/components/checkout/StepPayment";
import { StepRegister } from "@/components/checkout/StepRegister";
import { StepCompanyForm, Socio, CompanyDocuments, createEmptySocio } from "@/components/checkout/StepCompanyForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyFormationSubmit } from "@/hooks/useCompanyFormationSubmit";
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
  const { toast } = useToast();
  const auth = useAuth();

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

  // Hook for Step 5 submission
  const { isSubmitting, createFormation } = useCompanyFormationSubmit({
    onSessionExpired: () => setCurrentStep(4),
  });

  // Check user session and load resume data
  useEffect(() => {
    const checkUserAndLoadData = async () => {
      if (auth.isLoading) return;

      if (!auth.user) {
        setIsLoadingResume(false);
        return;
      }

      const { data: formation, error: formationError } = await supabase
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
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (formationError) {
        console.error("Error fetching company formation (Index resume):", formationError);
      }

      if (formation) {
        const partners = formation.partners as { id: string }[] | null;

        if (partners && partners.length > 0) {
          navigate("/acesso-portal");
          return;
        }

        const lead = formation.leads as { name: string; email: string; phone: string } | null;

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
  }, [auth.isLoading, auth.user, navigate]);

  const handleLeadSubmit = async () => {
    setIsLoading(true);
    try {
      const newLeadId = crypto.randomUUID();

      const { error } = await supabase.from("leads").insert({
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
        let currentUserId: string | null = null;
        try {
          currentUserId = await auth.ensureUserId();
        } catch {
          currentUserId = null;
        }

        const { error: subError } = await supabase.from("subscriptions").insert({
          lead_id: leadId,
          user_id: currentUserId,
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

      const successMessage =
        paymentData.paymentMethod === "CREDIT_CARD"
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

  /**
   * Step 5 submit handler - uses the extracted hook.
   * hasEcpfFromForm comes from the form (user's selection at submit time).
   */
  const handleSubmit = async (hasEcpfFromForm: boolean) => {
    if (!leadId) return;

    await createFormation(
      {
        leadId,
        socios,
        iptu,
        hasEcpf,
        companyDocuments,
      },
      hasEcpfFromForm
    );
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
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Abra sua empresa</h1>
          <p className="text-muted-foreground">Complete o cadastro para começar</p>
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
                onNext={handleRegisterNext}
                onBack={handleBack}
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
                isLoading={isSubmitting || isLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
