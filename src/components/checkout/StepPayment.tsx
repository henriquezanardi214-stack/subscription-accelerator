import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepPaymentProps {
  selectedPlan: string;
  onSelectPlan: (plan: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const plans = [
  {
    id: "essencial",
    name: "Essencial",
    description: "Plano ideal para quem trabalha como PJ em outra empresa",
    price: 189,
    features: [
      { name: "Abertura de empresa", included: true },
      { name: "Emissor de NFS-e", included: true },
      { name: "Contabilidade completa", included: true },
      { name: "Pró-labore", value: "Até 1 sócio" },
      { name: "Atendimento por chat e e-mail", included: true },
      { name: "Certificado Digital", included: true },
      { name: "Folha de pagamento", included: false },
      { name: "Atendimento por whatsapp", included: false },
      { name: "Atendimento por telefone", included: false },
      { name: "Emissão de nota pelo contador", included: false },
      { name: "BPO Financeiro", included: false },
    ],
  },
  {
    id: "intermediario",
    name: "Intermediário",
    description: "Plano ideal pequenas empresas, com até 2 funcionários",
    price: 239,
    popular: true,
    features: [
      { name: "Abertura de empresa", included: true },
      { name: "Emissor de NFS-e", included: true },
      { name: "Contabilidade completa", included: true },
      { name: "Pró-labore", value: "Até 3 sócios" },
      { name: "Atendimento por chat e e-mail", included: true },
      { name: "Certificado Digital", included: true },
      { name: "Folha de pagamento", value: "2 funcionários" },
      { name: "Atendimento por whatsapp", included: true },
      { name: "Atendimento por telefone", included: false },
      { name: "Emissão de nota pelo contador", included: false },
      { name: "BPO Financeiro", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Plano ideal empresas maiores, com até 5 funcionários",
    price: 439,
    features: [
      { name: "Abertura de empresa", included: true },
      { name: "Emissor de NFS-e", included: true },
      { name: "Contabilidade completa", included: true },
      { name: "Pró-labore", value: "Até 5 sócios" },
      { name: "Atendimento por chat e e-mail", included: true },
      { name: "Certificado Digital", included: true },
      { name: "Folha de pagamento", value: "5 funcionários" },
      { name: "Atendimento por whatsapp", included: true },
      { name: "Atendimento por telefone", included: true },
      { name: "Emissão de nota pelo contador*", included: true },
      { name: "BPO Financeiro", included: true },
    ],
  },
];

export const StepPayment = ({
  selectedPlan,
  onSelectPlan,
  onNext,
  onBack,
}: StepPaymentProps) => {
  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Escolha seu plano
        </h2>
        <p className="text-muted-foreground">
          Selecione o plano ideal para sua empresa
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => onSelectPlan(plan.id)}
            className={cn(
              "relative rounded-xl border-2 p-6 cursor-pointer transition-all duration-300 bg-card",
              selectedPlan === plan.id
                ? "border-primary shadow-glow"
                : "border-border hover:border-primary/50",
              plan.popular && "ring-2 ring-primary/20"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 gradient-primary text-primary-foreground text-xs font-semibold rounded-full">
                Mais popular
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-foreground mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {plan.description}
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="text-4xl font-bold text-foreground">
                  {plan.price}
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </div>

            <Button
              type="button"
              className={cn(
                "w-full mb-6 font-semibold",
                selectedPlan === plan.id
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
            >
              {selectedPlan === plan.id ? "✓ Selecionado" : "→ Quero esse!"}
            </Button>

            <div className="space-y-3">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  {feature.included || feature.value ? (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      feature.included || feature.value
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {feature.name}
                  </span>
                  {feature.value && (
                    <span className="ml-auto text-primary font-medium">
                      {feature.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 max-w-md mx-auto">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 h-12 font-semibold"
        >
          <ArrowLeft className="mr-2 w-5 h-5" />
          Voltar
        </Button>
        <Button
          type="button"
          disabled={!selectedPlan}
          onClick={onNext}
          className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Continuar
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
