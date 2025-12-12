import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Building2, Briefcase, TrendingUp } from "lucide-react";

interface QualificationData {
  segmento: string;
  areaAtuacao: string;
  faturamento: string;
}

interface StepQualificationProps {
  data: QualificationData;
  onUpdate: (data: QualificationData) => void;
  onNext: () => void;
  onBack: () => void;
  onDisqualified: () => void;
}

const segmentos = ["Serviço", "Comércio", "Indústria", "Imobiliário"];

const areasAtuacao = [
  "PJ em uma empresa",
  "Saúde",
  "Marketing",
  "Engenharia",
  "Administrativo",
  "Representação Comercial",
  "Direito",
  "Corretagem",
  "Outros",
];

const faturamentos = [
  "0 - 10 mil/mês",
  "Entre 10 mil/mês - 50 mil/mês",
  "Entre 50 mil/mês - 200 mil/mês",
  "Entre 200 mil/mês - 1 milhão/mês",
  "Acima de 1 milhão/mês",
];

export const StepQualification = ({
  data,
  onUpdate,
  onNext,
  onBack,
  onDisqualified,
}: StepQualificationProps) => {
  const [errors, setErrors] = useState<Partial<QualificationData>>({});

  const validate = () => {
    const newErrors: Partial<QualificationData> = {};

    if (!data.segmento) {
      newErrors.segmento = "Selecione o segmento";
    }

    if (!data.areaAtuacao) {
      newErrors.areaAtuacao = "Selecione a área de atuação";
    }

    if (!data.faturamento) {
      newErrors.faturamento = "Selecione a previsão de faturamento";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isQualified = () => {
    // Não qualificado se:
    // - Segmento NÃO for "Serviço"
    // - Área de atuação for "Outros"
    // - Faturamento for "Acima de 1 milhão/mês"
    if (data.segmento !== "Serviço") return false;
    if (data.areaAtuacao === "Outros") return false;
    if (data.faturamento === "Acima de 1 milhão/mês") return false;
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      if (isQualified()) {
        onNext();
      } else {
        onDisqualified();
      }
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Conte-nos sobre sua empresa
        </h2>
        <p className="text-muted-foreground">
          Precisamos entender melhor o seu negócio
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label className="text-foreground font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Segmento da empresa
          </Label>
          <Select
            value={data.segmento}
            onValueChange={(value) => onUpdate({ ...data, segmento: value })}
          >
            <SelectTrigger className="h-12 bg-card border-border">
              <SelectValue placeholder="Selecione o segmento" />
            </SelectTrigger>
            <SelectContent>
              {segmentos.map((seg) => (
                <SelectItem key={seg} value={seg}>
                  {seg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.segmento && (
            <p className="text-sm text-destructive">{errors.segmento}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-foreground font-medium flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            Área de atuação
          </Label>
          <Select
            value={data.areaAtuacao}
            onValueChange={(value) => onUpdate({ ...data, areaAtuacao: value })}
          >
            <SelectTrigger className="h-12 bg-card border-border">
              <SelectValue placeholder="Selecione a área de atuação" />
            </SelectTrigger>
            <SelectContent>
              {areasAtuacao.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.areaAtuacao && (
            <p className="text-sm text-destructive">{errors.areaAtuacao}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-foreground font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Previsão de faturamento mensal
          </Label>
          <Select
            value={data.faturamento}
            onValueChange={(value) => onUpdate({ ...data, faturamento: value })}
          >
            <SelectTrigger className="h-12 bg-card border-border">
              <SelectValue placeholder="Selecione a previsão de faturamento" />
            </SelectTrigger>
            <SelectContent>
              {faturamentos.map((fat) => (
                <SelectItem key={fat} value={fat}>
                  {fat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.faturamento && (
            <p className="text-sm text-destructive">{errors.faturamento}</p>
          )}
        </div>

        <div className="flex gap-4">
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
            type="submit"
            className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Continuar
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};
