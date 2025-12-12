import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "@/components/checkout/Stepper";
import { StepLead } from "@/components/checkout/StepLead";
import { StepQualification } from "@/components/checkout/StepQualification";
import { StepPayment } from "@/components/checkout/StepPayment";
import { StepCompanyForm } from "@/components/checkout/StepCompanyForm";

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

const Index = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

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

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleDisqualified = () => {
    navigate("/desqualificado");
  };

  const handleSubmit = () => {
    // Here you would typically send the data to your backend
    console.log("Form submitted:", {
      lead: leadData,
      qualification: qualificationData,
      plan: selectedPlan,
      socios,
      iptu,
    });
    navigate("/sucesso");
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
                onNext={handleNext}
              />
            )}

            {currentStep === 2 && (
              <StepQualification
                data={qualificationData}
                onUpdate={setQualificationData}
                onNext={handleNext}
                onBack={handleBack}
                onDisqualified={handleDisqualified}
              />
            )}

            {currentStep === 3 && (
              <StepPayment
                selectedPlan={selectedPlan}
                onSelectPlan={setSelectedPlan}
                onNext={handleNext}
                onBack={handleBack}
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
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
