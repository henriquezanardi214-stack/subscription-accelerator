import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "@/components/checkout/Stepper";
import { StepLead } from "@/components/checkout/StepLead";
import { StepQualification } from "@/components/checkout/StepQualification";
import { StepPayment, plans } from "@/components/checkout/StepPayment";
import { StepCompanyForm } from "@/components/checkout/StepCompanyForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { title: "Seus dados", description: "Informações de contato" },
  { title: "Qualificação", description: "Sobre sua empresa" },
  { title: "Plano", description: "Escolha seu plano" },
  { title: "Abertura", description: "Dados da empresa" },
];

interface Socio {
  id: string;
  nome: string;
  rg: string;
  cpf: string;
  cep: string;
  endereco: string;
  cidadeUf: string;
}

interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CardHolderInfo {
  cpf: string;
  postalCode: string;
  addressNumber: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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

  // Step 4 - Company Form
  const [socios, setSocios] = useState<Socio[]>([
    {
      id: crypto.randomUUID(),
      nome: "",
      rg: "",
      cpf: "",
      cep: "",
      endereco: "",
      cidadeUf: "",
    },
  ]);
  const [iptu, setIptu] = useState("");

  const handleLeadSubmit = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: leadData.nome,
          email: leadData.email,
          phone: leadData.telefone,
        })
        .select()
        .single();

      if (error) throw error;

      setLeadId(data.id);
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

  const handlePaymentNext = async (creditCard: CreditCardData, cardHolderInfo: CardHolderInfo) => {
    setIsLoading(true);
    try {
      const selectedPlanData = plans.find((p) => p.id === selectedPlan);
      if (!selectedPlanData) throw new Error("Plano não selecionado");

      const response = await supabase.functions.invoke("create-subscription", {
        body: {
          customer: {
            name: leadData.nome,
            email: leadData.email,
            phone: leadData.telefone,
            cpfCnpj: cardHolderInfo.cpf,
          },
          creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number,
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv,
          },
          creditCardHolderInfo: {
            name: creditCard.holderName,
            email: leadData.email,
            cpfCnpj: cardHolderInfo.cpf,
            postalCode: cardHolderInfo.postalCode,
            addressNumber: cardHolderInfo.addressNumber,
            phone: leadData.telefone,
          },
          planId: selectedPlan,
          planValue: selectedPlanData.price,
          remoteIp: "0.0.0.0",
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao processar pagamento");
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || "Erro ao processar pagamento");
      }

      toast({
        title: "Pagamento aprovado!",
        description: "Sua assinatura foi criada com sucesso.",
      });

      setCurrentStep(4);
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Erro no pagamento",
        description: error instanceof Error ? error.message : "Erro ao processar pagamento. Verifique os dados do cartão.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!leadId) return;

    setIsLoading(true);
    try {
      // Create company formation record
      const { data: formationData, error: formationError } = await supabase
        .from("company_formations")
        .insert({
          lead_id: leadId,
          iptu: iptu,
        })
        .select()
        .single();

      if (formationError) throw formationError;

      // Insert all partners
      const partnersToInsert = socios.map((socio) => ({
        company_formation_id: formationData.id,
        name: socio.nome,
        rg: socio.rg,
        cpf: socio.cpf.replace(/\D/g, ""),
        cep: socio.cep.replace(/\D/g, ""),
        address: socio.endereco,
        city_state: socio.cidadeUf,
      }));

      const { error: partnersError } = await supabase
        .from("partners")
        .insert(partnersToInsert);

      if (partnersError) throw partnersError;

      navigate("/sucesso");
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
              <StepCompanyForm
                socios={socios}
                iptu={iptu}
                onUpdateSocios={setSocios}
                onUpdateIptu={setIptu}
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
