import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, User, FileText, MapPin, Building, Loader2, Search } from "lucide-react";
import { useCepLookup } from "@/hooks/useCepLookup";

interface Socio {
  id: string;
  nome: string;
  rg: string;
  cpf: string;
  cep: string;
  endereco: string;
  cidadeUf: string;
}

interface StepCompanyFormProps {
  socios: Socio[];
  iptu: string;
  onUpdateSocios: (socios: Socio[]) => void;
  onUpdateIptu: (iptu: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

const createEmptySocio = (): Socio => ({
  id: crypto.randomUUID(),
  nome: "",
  rg: "",
  cpf: "",
  cep: "",
  endereco: "",
  cidadeUf: "",
});

export const StepCompanyForm = ({
  socios,
  iptu,
  onUpdateSocios,
  onUpdateIptu,
  onBack,
  onSubmit,
  isLoading,
}: StepCompanyFormProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingCep, setLoadingCep] = useState<string | null>(null);
  const { lookupCep } = useCepLookup();

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9)
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepBlur = async (socioId: string, cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setLoadingCep(socioId);
    const address = await lookupCep(cep);
    setLoadingCep(null);

    if (address) {
      const updated = socios.map((s) =>
        s.id === socioId
          ? {
              ...s,
              endereco: address.logradouro ? `${address.logradouro}, ${address.bairro}` : s.endereco,
              cidadeUf: address.cidadeUf,
            }
          : s
      );
      onUpdateSocios(updated);
    }
  };

  const handleSocioChange = (id: string, field: keyof Socio, value: string) => {
    let formattedValue = value;
    
    if (field === "cpf") {
      formattedValue = formatCpf(value);
    } else if (field === "cep") {
      formattedValue = formatCep(value);
    } else if (field === "rg") {
      formattedValue = value.replace(/\D/g, "");
    }

    const updated = socios.map((s) =>
      s.id === id ? { ...s, [field]: formattedValue } : s
    );
    onUpdateSocios(updated);
  };

  const addSocio = () => {
    onUpdateSocios([...socios, createEmptySocio()]);
  };

  const removeSocio = (id: string) => {
    if (socios.length > 1) {
      onUpdateSocios(socios.filter((s) => s.id !== id));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    socios.forEach((socio) => {
      if (!socio.nome.trim()) {
        newErrors[`${socio.id}-nome`] = "Nome é obrigatório";
      }
      if (!socio.rg.trim()) {
        newErrors[`${socio.id}-rg`] = "RG é obrigatório";
      }
      if (!socio.cpf.trim() || socio.cpf.replace(/\D/g, "").length !== 11) {
        newErrors[`${socio.id}-cpf`] = "CPF inválido";
      }
      if (!socio.cep.trim() || socio.cep.replace(/\D/g, "").length !== 8) {
        newErrors[`${socio.id}-cep`] = "CEP inválido";
      }
      if (!socio.endereco.trim()) {
        newErrors[`${socio.id}-endereco`] = "Endereço é obrigatório";
      }
      if (!socio.cidadeUf.trim()) {
        newErrors[`${socio.id}-cidadeUf`] = "Cidade/UF é obrigatório";
      }
    });

    if (!iptu.trim()) {
      newErrors["iptu"] = "IPTU é obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit();
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Dados para abertura da empresa
        </h2>
        <p className="text-muted-foreground">
          Preencha as informações dos sócios
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {socios.map((socio, index) => (
          <div
            key={socio.id}
            className="p-6 rounded-xl border border-border bg-card/50 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Sócio {index + 1}
              </h3>
              {socios.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSocio(socio.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isLoading}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-foreground">Nome do Sócio</Label>
                <Input
                  placeholder="Nome completo"
                  value={socio.nome}
                  onChange={(e) =>
                    handleSocioChange(socio.id, "nome", e.target.value)
                  }
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-nome`] && (
                  <p className="text-sm text-destructive">
                    {errors[`${socio.id}-nome`]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  RG (Apenas números)
                </Label>
                <Input
                  placeholder="000000000"
                  value={socio.rg}
                  onChange={(e) =>
                    handleSocioChange(socio.id, "rg", e.target.value)
                  }
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-rg`] && (
                  <p className="text-sm text-destructive">
                    {errors[`${socio.id}-rg`]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">CPF (Apenas números)</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={socio.cpf}
                  onChange={(e) =>
                    handleSocioChange(socio.id, "cpf", e.target.value)
                  }
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-cpf`] && (
                  <p className="text-sm text-destructive">
                    {errors[`${socio.id}-cpf`]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-2">
                  <MapPin className="w-3 h-3" />
                  CEP
                </Label>
                <div className="relative">
                  <Input
                    placeholder="00000-000"
                    value={socio.cep}
                    onChange={(e) =>
                      handleSocioChange(socio.id, "cep", e.target.value)
                    }
                    onBlur={(e) => handleCepBlur(socio.id, e.target.value)}
                    className="h-11 bg-card pr-10"
                    disabled={isLoading}
                  />
                  {loadingCep === socio.id ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                {errors[`${socio.id}-cep`] && (
                  <p className="text-sm text-destructive">
                    {errors[`${socio.id}-cep`]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Cidade/UF</Label>
                <Input
                  placeholder="São Paulo/SP"
                  value={socio.cidadeUf}
                  onChange={(e) =>
                    handleSocioChange(socio.id, "cidadeUf", e.target.value)
                  }
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-cidadeUf`] && (
                  <p className="text-sm text-destructive">
                    {errors[`${socio.id}-cidadeUf`]}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label className="text-foreground">
                  Endereço, n° e Complemento
                </Label>
                <Input
                  placeholder="Rua, número, apartamento..."
                  value={socio.endereco}
                  onChange={(e) =>
                    handleSocioChange(socio.id, "endereco", e.target.value)
                  }
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-endereco`] && (
                  <p className="text-sm text-destructive">
                    {errors[`${socio.id}-endereco`]}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addSocio}
          className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5"
          disabled={isLoading}
        >
          <Plus className="mr-2 w-5 h-5" />
          Adicionar outro sócio
        </Button>

        <div className="p-6 rounded-xl border border-border bg-card/50 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            Dados da Empresa
          </h3>
          <div className="space-y-2">
            <Label className="text-foreground">IPTU (Empresa)</Label>
            <Input
              placeholder="Número do IPTU"
              value={iptu}
              onChange={(e) => onUpdateIptu(e.target.value)}
              className="h-11 bg-card"
              disabled={isLoading}
            />
            {errors["iptu"] && (
              <p className="text-sm text-destructive">{errors["iptu"]}</p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 h-12 font-semibold"
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              "Finalizar cadastro"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
