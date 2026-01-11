import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, User, Mail, Phone, Loader2 } from "lucide-react";

interface LeadData {
  nome: string;
  email: string;
  telefone: string;
}

interface StepLeadProps {
  data: LeadData;
  onUpdate: (data: LeadData) => void;
  onNext: () => void;
  isLoading?: boolean;
}

export const StepLead = ({ data, onUpdate, onNext, isLoading }: StepLeadProps) => {
  const [errors, setErrors] = useState<Partial<LeadData>>({});

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    onUpdate({ ...data, telefone: formatted });
  };

  const validate = () => {
    const newErrors: Partial<LeadData> = {};
    
    if (!data.nome.trim()) {
      newErrors.nome = "Nome é obrigatório";
    }
    
    if (!data.email.trim()) {
      newErrors.email = "E-mail é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      newErrors.email = "E-mail inválido";
    }
    
    if (!data.telefone.trim()) {
      newErrors.telefone = "Telefone é obrigatório";
    } else if (data.telefone.replace(/\D/g, "").length < 10) {
      newErrors.telefone = "Telefone inválido";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Vamos começar!
        </h2>
        <p className="text-muted-foreground">
          Preencha seus dados para iniciar sua jornada
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="nome" className="text-foreground font-medium">
            Nome completo
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="nome"
              type="text"
              placeholder="Digite seu nome completo"
              value={data.nome}
              onChange={(e) => onUpdate({ ...data, nome: e.target.value })}
              className="pl-10 h-12 bg-card border-border focus:border-primary focus:ring-primary"
              disabled={isLoading}
            />
          </div>
          {errors.nome && (
            <p className="text-sm text-destructive">{errors.nome}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground font-medium">
            E-mail
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={data.email}
              onChange={(e) => onUpdate({ ...data, email: e.target.value })}
              className="pl-10 h-12 bg-card border-border focus:border-primary focus:ring-primary"
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone" className="text-foreground font-medium">
            Telefone
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="telefone"
              type="tel"
              placeholder="(00) 00000-0000"
              value={data.telefone}
              onChange={handlePhoneChange}
              className="pl-10 h-12 bg-card border-border focus:border-primary focus:ring-primary"
              disabled={isLoading}
            />
          </div>
          {errors.telefone && (
            <p className="text-sm text-destructive">{errors.telefone}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 gradient-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Continuar
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>

        <div className="text-center pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Já começou o cadastro?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Faça login para continuar
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};
