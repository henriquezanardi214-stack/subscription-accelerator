import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, X, ArrowRight, CreditCard, Loader2, Search, QrCode, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCepLookup } from "@/hooks/useCepLookup";

export type PaymentMethod = "CREDIT_CARD" | "BOLETO" | "PIX";

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

export interface PaymentData {
  paymentMethod: PaymentMethod;
  creditCard?: CreditCardData;
  cardHolderInfo?: CardHolderInfo;
  cpfCnpj?: string;
}

interface StepPaymentProps {
  selectedPlan: string;
  onSelectPlan: (plan: string) => void;
  onNext: (paymentData: PaymentData) => void;
  onBack: () => void;
  isLoading?: boolean;
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

const paymentMethods = [
  { id: "CREDIT_CARD" as PaymentMethod, name: "Cartão de Crédito", icon: CreditCard, description: "Pagamento recorrente mensal" },
  { id: "BOLETO" as PaymentMethod, name: "Boleto Bancário", icon: FileText, description: "Vencimento em 3 dias úteis" },
  { id: "PIX" as PaymentMethod, name: "PIX", icon: QrCode, description: "Pagamento instantâneo" },
];

export const StepPayment = ({
  selectedPlan,
  onSelectPlan,
  onNext,
  onBack,
  isLoading = false,
}: StepPaymentProps) => {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("CREDIT_CARD");
  const [loadingCep, setLoadingCep] = useState(false);
  const { lookupCep } = useCepLookup();
  const [creditCard, setCreditCard] = useState<CreditCardData>({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });
  const [cardHolderInfo, setCardHolderInfo] = useState<CardHolderInfo>({
    cpf: "",
    postalCode: "",
    addressNumber: "",
  });
  const [cpfCnpj, setCpfCnpj] = useState("");

  const handleCepBlur = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    const address = await lookupCep(cep);
    setLoadingCep(false);

    if (address) {
      // Auto-fill address number hint if available
      console.log("Endereço encontrado:", address.logradouro, address.cidadeUf);
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(" ").substring(0, 19) : "";
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return cleaned
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const formatCEP = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.replace(/(\d{5})(\d)/, "$1-$2").substring(0, 9);
  };

  const handleContinueToPayment = () => {
    if (selectedPlan) {
      setShowPaymentForm(true);
    }
  };

  const handleSubmitPayment = () => {
    if (selectedPaymentMethod === "CREDIT_CARD") {
      if (
        creditCard.holderName &&
        creditCard.number &&
        creditCard.expiryMonth &&
        creditCard.expiryYear &&
        creditCard.ccv &&
        cardHolderInfo.cpf &&
        cardHolderInfo.postalCode &&
        cardHolderInfo.addressNumber
      ) {
        onNext({ paymentMethod: selectedPaymentMethod, creditCard, cardHolderInfo, cpfCnpj: cardHolderInfo.cpf });
      }
    } else {
      // Boleto or PIX - need the CPF/CNPJ
      if (cpfCnpj.replace(/\D/g, "").length >= 11) {
        onNext({ paymentMethod: selectedPaymentMethod, cpfCnpj });
      }
    }
  };

  const isCreditCardFormValid =
    creditCard.holderName.length > 3 &&
    creditCard.number.replace(/\s/g, "").length >= 13 &&
    creditCard.expiryMonth.length === 2 &&
    creditCard.expiryYear.length === 4 &&
    creditCard.ccv.length >= 3 &&
    cardHolderInfo.cpf.replace(/\D/g, "").length >= 11 &&
    cardHolderInfo.postalCode.replace(/\D/g, "").length === 8 &&
    cardHolderInfo.addressNumber.length > 0;

  const isBoletoPixFormValid = cpfCnpj.replace(/\D/g, "").length >= 11;

  const isPaymentFormValid = selectedPaymentMethod === "CREDIT_CARD" ? isCreditCardFormValid : isBoletoPixFormValid;

  if (showPaymentForm) {
    const selectedPlanData = plans.find((p) => p.id === selectedPlan);

    return (
      <div className="animate-slide-up">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Dados do Pagamento
          </h2>
          <p className="text-muted-foreground">
            Plano {selectedPlanData?.name} - R$ {selectedPlanData?.price}/mês
          </p>
        </div>

        <div className="space-y-6">
          {/* Payment Method Selection */}
          <div className="grid grid-cols-3 gap-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedPaymentMethod(method.id)}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all duration-200 text-center",
                    selectedPaymentMethod === method.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 bg-card"
                  )}
                >
                  <Icon className={cn(
                    "w-6 h-6 mx-auto mb-2",
                    selectedPaymentMethod === method.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium block",
                    selectedPaymentMethod === method.id ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {method.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{method.description}</span>
                </button>
              );
            })}
          </div>

          {/* Credit Card Form */}
          {selectedPaymentMethod === "CREDIT_CARD" && (
            <>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">Dados do Cartão</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="holderName">Nome no Cartão</Label>
                    <Input
                      id="holderName"
                      placeholder="Nome como está no cartão"
                      value={creditCard.holderName}
                      onChange={(e) =>
                        setCreditCard({ ...creditCard, holderName: e.target.value.toUpperCase() })
                      }
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={creditCard.number}
                      onChange={(e) =>
                        setCreditCard({ ...creditCard, number: formatCardNumber(e.target.value) })
                      }
                      maxLength={19}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="expiryMonth">Mês</Label>
                      <Input
                        id="expiryMonth"
                        placeholder="MM"
                        value={creditCard.expiryMonth}
                        onChange={(e) =>
                          setCreditCard({
                            ...creditCard,
                            expiryMonth: e.target.value.replace(/\D/g, "").substring(0, 2),
                          })
                        }
                        maxLength={2}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiryYear">Ano</Label>
                      <Input
                        id="expiryYear"
                        placeholder="AAAA"
                        value={creditCard.expiryYear}
                        onChange={(e) =>
                          setCreditCard({
                            ...creditCard,
                            expiryYear: e.target.value.replace(/\D/g, "").substring(0, 4),
                          })
                        }
                        maxLength={4}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ccv">CVV</Label>
                      <Input
                        id="ccv"
                        placeholder="123"
                        type="password"
                        value={creditCard.ccv}
                        onChange={(e) =>
                          setCreditCard({
                            ...creditCard,
                            ccv: e.target.value.replace(/\D/g, "").substring(0, 4),
                          })
                        }
                        maxLength={4}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <span className="font-semibold text-foreground mb-4 block">
                  Dados do Titular
                </span>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cpf">CPF/CNPJ</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={cardHolderInfo.cpf}
                      onChange={(e) =>
                        setCardHolderInfo({ ...cardHolderInfo, cpf: formatCPF(e.target.value) })
                      }
                      maxLength={18}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="postalCode">CEP</Label>
                      <div className="relative">
                        <Input
                          id="postalCode"
                          placeholder="00000-000"
                          value={cardHolderInfo.postalCode}
                          onChange={(e) =>
                            setCardHolderInfo({
                              ...cardHolderInfo,
                              postalCode: formatCEP(e.target.value),
                            })
                          }
                          onBlur={(e) => handleCepBlur(e.target.value)}
                          maxLength={9}
                          className="mt-1 pr-10"
                        />
                        {loadingCep ? (
                          <Loader2 className="absolute right-3 top-1/2 translate-y-[-25%] w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Search className="absolute right-3 top-1/2 translate-y-[-25%] w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="addressNumber">Número</Label>
                      <Input
                        id="addressNumber"
                        placeholder="123"
                        value={cardHolderInfo.addressNumber}
                        onChange={(e) =>
                          setCardHolderInfo({ ...cardHolderInfo, addressNumber: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Boleto Info */}
          {selectedPaymentMethod === "BOLETO" && (
            <div className="p-6 rounded-lg bg-secondary/30 border border-border">
              <div className="text-center mb-6">
                <FileText className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Pagamento via Boleto</h3>
                <p className="text-muted-foreground text-sm">
                  Após confirmar, você receberá um boleto bancário por e-mail com vencimento em 3 dias úteis.
                </p>
              </div>
              <div>
                <Label htmlFor="cpfBoleto">CPF/CNPJ</Label>
                <Input
                  id="cpfBoleto"
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(formatCPF(e.target.value))}
                  maxLength={18}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* PIX Info */}
          {selectedPaymentMethod === "PIX" && (
            <div className="p-6 rounded-lg bg-secondary/30 border border-border">
              <div className="text-center mb-6">
                <QrCode className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Pagamento via PIX</h3>
                <p className="text-muted-foreground text-sm">
                  Após confirmar, você receberá um QR Code e código PIX para pagamento instantâneo.
                </p>
              </div>
              <div>
                <Label htmlFor="cpfPix">CPF/CNPJ</Label>
                <Input
                  id="cpfPix"
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(formatCPF(e.target.value))}
                  maxLength={18}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPaymentForm(false)}
            className="flex-1 h-12 font-semibold"
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar
          </Button>
          <Button
            type="button"
            disabled={!isPaymentFormValid || isLoading}
            onClick={handleSubmitPayment}
            className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                Finalizar Pagamento
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

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

      {/* Disclaimer */}
      <p className="text-center text-sm text-muted-foreground mb-6">
        Ao clicar em Finalizar, você está declarando que leu e concordou com nosso{" "}
        <a
          href="https://contabiliadigital.com.br/wp-content/uploads/2026/02/Termos-e-Condicoes-Contabilia.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          Contrato de Prestação de Serviços
        </a>
      </p>

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
          onClick={handleContinueToPayment}
          className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Continuar
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export { plans };
