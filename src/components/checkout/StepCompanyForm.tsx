import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Plus, Trash2, User, FileText, MapPin, Building, Loader2, Search } from "lucide-react";
import { useCepLookup } from "@/hooks/useCepLookup";
import { validateCpf, formatCpf } from "@/lib/cpf";
import { FileUpload } from "./FileUpload";

interface SocioDocument {
  rg_url?: string;
  rg_name?: string;
  cnh_url?: string;
  cnh_name?: string;
}

interface Socio {
  id: string;
  nome: string;
  rg: string;
  cpf: string;
  cep: string;
  endereco: string;
  cidadeUf: string;
  estadoCivil: string;
  naturalidadeCidade: string;
  naturalidadeEstado: string;
  documents: SocioDocument;
}

interface CompanyDocuments {
  iptu_url?: string;
  iptu_name?: string;
  avcb_url?: string;
  avcb_name?: string;
  ecpf_url?: string;
  ecpf_name?: string;
}

interface StepCompanyFormProps {
  socios: Socio[];
  iptu: string;
  hasEcpf: boolean;
  companyDocuments: CompanyDocuments;
  onUpdateSocios: (socios: Socio[]) => void;
  onUpdateIptu: (iptu: string) => void;
  onUpdateHasEcpf: (hasEcpf: boolean) => void;
  onUpdateCompanyDocuments: (docs: CompanyDocuments) => void;
  onBack: () => void;
  onSubmit: (needsBiometria: boolean) => void;
  isLoading?: boolean;
}

const ESTADOS_CIVIS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
];

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
  "SP", "SE", "TO"
];

const createEmptySocio = (): Socio => ({
  id: crypto.randomUUID(),
  nome: "",
  rg: "",
  cpf: "",
  cep: "",
  endereco: "",
  cidadeUf: "",
  estadoCivil: "",
  naturalidadeCidade: "",
  naturalidadeEstado: "",
  documents: {},
});

export const StepCompanyForm = ({
  socios,
  iptu,
  hasEcpf,
  companyDocuments,
  onUpdateSocios,
  onUpdateIptu,
  onUpdateHasEcpf,
  onUpdateCompanyDocuments,
  onBack,
  onSubmit,
  isLoading,
}: StepCompanyFormProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingCep, setLoadingCep] = useState<string | null>(null);
  const { lookupCep } = useCepLookup();

  const handleCpfFormat = (value: string) => {
    return formatCpf(value);
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
      formattedValue = handleCpfFormat(value);
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

  const handleSocioDocumentChange = (
    socioId: string,
    docType: keyof SocioDocument,
    url: string | null,
    fileName: string | null
  ) => {
    const updated = socios.map((s) =>
      s.id === socioId
        ? {
            ...s,
            documents: {
              ...s.documents,
              [docType]: url,
              [`${docType.replace("_url", "_name")}`]: fileName,
            },
          }
        : s
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
      if (!socio.cpf.trim() || !validateCpf(socio.cpf)) {
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
      if (!socio.estadoCivil) {
        newErrors[`${socio.id}-estadoCivil`] = "Estado civil é obrigatório";
      }
      if (!socio.naturalidadeCidade.trim()) {
        newErrors[`${socio.id}-naturalidadeCidade`] = "Cidade é obrigatória";
      }
      if (!socio.naturalidadeEstado) {
        newErrors[`${socio.id}-naturalidadeEstado`] = "Estado é obrigatório";
      }
      if (!socio.documents.rg_url) {
        newErrors[`${socio.id}-doc-rg`] = "RG é obrigatório";
      }
    });

    if (!iptu.trim()) {
      newErrors["iptu"] = "IPTU é obrigatório";
    }

    if (!companyDocuments.iptu_url) {
      newErrors["doc-iptu"] = "Capa do IPTU é obrigatória";
    }

    if (hasEcpf && !companyDocuments.ecpf_url) {
      newErrors["doc-ecpf"] = "Certificado e-CPF é obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(!hasEcpf);
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
                  onChange={(e) => handleSocioChange(socio.id, "nome", e.target.value)}
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-nome`] && (
                  <p className="text-sm text-destructive">{errors[`${socio.id}-nome`]}</p>
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
                  onChange={(e) => handleSocioChange(socio.id, "rg", e.target.value)}
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-rg`] && (
                  <p className="text-sm text-destructive">{errors[`${socio.id}-rg`]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">CPF (Apenas números)</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={socio.cpf}
                  onChange={(e) => handleSocioChange(socio.id, "cpf", e.target.value)}
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-cpf`] && (
                  <p className="text-sm text-destructive">{errors[`${socio.id}-cpf`]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Estado Civil</Label>
                <Select
                  value={socio.estadoCivil}
                  onValueChange={(value) => handleSocioChange(socio.id, "estadoCivil", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-11 bg-card">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {ESTADOS_CIVIS.map((ec) => (
                      <SelectItem key={ec.value} value={ec.value}>
                        {ec.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors[`${socio.id}-estadoCivil`] && (
                  <p className="text-sm text-destructive">{errors[`${socio.id}-estadoCivil`]}</p>
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
                    onChange={(e) => handleSocioChange(socio.id, "cep", e.target.value)}
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
                  <p className="text-sm text-destructive">{errors[`${socio.id}-cep`]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Cidade/UF</Label>
                <Input
                  placeholder="São Paulo/SP"
                  value={socio.cidadeUf}
                  onChange={(e) => handleSocioChange(socio.id, "cidadeUf", e.target.value)}
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-cidadeUf`] && (
                  <p className="text-sm text-destructive">{errors[`${socio.id}-cidadeUf`]}</p>
                )}
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label className="text-foreground">Endereço, n° e Complemento</Label>
                <Input
                  placeholder="Rua, número, apartamento..."
                  value={socio.endereco}
                  onChange={(e) => handleSocioChange(socio.id, "endereco", e.target.value)}
                  className="h-11 bg-card"
                  disabled={isLoading}
                />
                {errors[`${socio.id}-endereco`] && (
                  <p className="text-sm text-destructive">{errors[`${socio.id}-endereco`]}</p>
                )}
              </div>

              {/* Naturalidade */}
              <div className="sm:col-span-2">
                <Label className="text-foreground mb-2 block">Local de Nascimento</Label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Cidade"
                      value={socio.naturalidadeCidade}
                      onChange={(e) => handleSocioChange(socio.id, "naturalidadeCidade", e.target.value)}
                      className="h-11 bg-card"
                      disabled={isLoading}
                    />
                    {errors[`${socio.id}-naturalidadeCidade`] && (
                      <p className="text-sm text-destructive">{errors[`${socio.id}-naturalidadeCidade`]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={socio.naturalidadeEstado}
                      onValueChange={(value) => handleSocioChange(socio.id, "naturalidadeEstado", value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-11 bg-card">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {ESTADOS_BRASIL.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[`${socio.id}-naturalidadeEstado`] && (
                      <p className="text-sm text-destructive">{errors[`${socio.id}-naturalidadeEstado`]}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Documentos do sócio */}
              <div className="sm:col-span-2 pt-4 border-t border-border">
                <h4 className="font-medium text-foreground mb-4">Documentos do Sócio</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <FileUpload
                      label="RG"
                      documentType={`rg-${socio.id}`}
                      required
                      value={socio.documents.rg_url}
                      onChange={(url, name) => handleSocioDocumentChange(socio.id, "rg_url", url, name)}
                      disabled={isLoading}
                    />
                    {errors[`${socio.id}-doc-rg`] && (
                      <p className="text-sm text-destructive mt-1">{errors[`${socio.id}-doc-rg`]}</p>
                    )}
                  </div>
                  <FileUpload
                    label="CNH (opcional)"
                    documentType={`cnh-${socio.id}`}
                    value={socio.documents.cnh_url}
                    onChange={(url, name) => handleSocioDocumentChange(socio.id, "cnh_url", url, name)}
                    disabled={isLoading}
                  />
                </div>
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

        {/* Dados da Empresa */}
        <div className="p-6 rounded-xl border border-border bg-card/50 space-y-6">
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

          {/* Documentos da empresa */}
          <div className="pt-4 border-t border-border space-y-4">
            <h4 className="font-medium text-foreground">Documentos da Empresa</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <FileUpload
                  label="Capa do IPTU"
                  documentType="iptu-capa"
                  required
                  value={companyDocuments.iptu_url}
                  onChange={(url, name) =>
                    onUpdateCompanyDocuments({ ...companyDocuments, iptu_url: url || undefined, iptu_name: name || undefined })
                  }
                  disabled={isLoading}
                />
                {errors["doc-iptu"] && (
                  <p className="text-sm text-destructive mt-1">{errors["doc-iptu"]}</p>
                )}
              </div>
              <FileUpload
                label="AVCB (opcional)"
                documentType="avcb"
                value={companyDocuments.avcb_url}
                onChange={(url, name) =>
                  onUpdateCompanyDocuments({ ...companyDocuments, avcb_url: url || undefined, avcb_name: name || undefined })
                }
                disabled={isLoading}
              />
            </div>
          </div>

          {/* e-CPF */}
          <div className="pt-4 border-t border-border space-y-4">
            <Label className="text-foreground">Possui e-CPF?</Label>
            <RadioGroup
              value={hasEcpf ? "sim" : "nao"}
              onValueChange={(value) => onUpdateHasEcpf(value === "sim")}
              className="flex gap-6"
              disabled={isLoading}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sim" id="ecpf-sim" />
                <Label htmlFor="ecpf-sim" className="cursor-pointer">Sim</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao" id="ecpf-nao" />
                <Label htmlFor="ecpf-nao" className="cursor-pointer">Não</Label>
              </div>
            </RadioGroup>

            {hasEcpf && (
              <div className="mt-4">
                <FileUpload
                  label="Certificado e-CPF"
                  documentType="ecpf-certificado"
                  required
                  value={companyDocuments.ecpf_url}
                  onChange={(url, name) =>
                    onUpdateCompanyDocuments({ ...companyDocuments, ecpf_url: url || undefined, ecpf_name: name || undefined })
                  }
                  disabled={isLoading}
                />
                {errors["doc-ecpf"] && (
                  <p className="text-sm text-destructive mt-1">{errors["doc-ecpf"]}</p>
                )}
              </div>
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

export { createEmptySocio };
export type { Socio, SocioDocument, CompanyDocuments };
