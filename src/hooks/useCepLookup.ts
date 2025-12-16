import { useState, useCallback } from "react";

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface AddressData {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cidadeUf: string;
}

export const useCepLookup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupCep = useCallback(async (cep: string): Promise<AddressData | null> => {
    const cleanCep = cep.replace(/\D/g, "");
    
    if (cleanCep.length !== 8) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCepResponse = await response.json();

      if (data.erro) {
        setError("CEP não encontrado");
        return null;
      }

      return {
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
        cidadeUf: `${data.localidade}/${data.uf}`,
      };
    } catch (err) {
      setError("Erro ao buscar CEP");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookupCep, isLoading, error };
};
