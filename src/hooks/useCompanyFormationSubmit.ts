import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AuthRequiredError } from "@/lib/auth";
import type { Socio, CompanyDocuments } from "@/components/checkout/StepCompanyForm";

/** Error types for consistent handling */
export type SubmitErrorType = "network" | "session" | "database" | "unknown";

export interface SubmitResult {
  success: boolean;
  errorType?: SubmitErrorType;
  errorMessage?: string;
}

interface UseCompanyFormationSubmitOptions {
  /** Called when session is expired and user should re-authenticate */
  onSessionExpired?: () => void;
}

interface CreateFormationParams {
  leadId: string;
  socios: Socio[];
  iptu: string;
  hasEcpf: boolean;
  companyDocuments: CompanyDocuments;
}

interface UpdateFormationParams {
  formationId: string;
  socios: Socio[];
  iptu: string;
  hasEcpf: boolean;
  companyDocuments: CompanyDocuments;
}

/**
 * Hook to handle company formation persistence (create and update).
 * Centralizes auth validation, error handling, and navigation logic.
 */
export function useCompanyFormationSubmit(options: UseCompanyFormationSubmitOptions = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthTokenError = (err: unknown) => {
    const e = err as { message?: string; status?: number; code?: string };
    const msg = (e?.message || "").toLowerCase();
    return (
      e?.status === 401 ||
      /jwt|token|not authenticated|auth/i.test(msg) && /expired|invalid|missing/i.test(msg)
    );
  };

  /**
   * Classifies an error into a known type for consistent UI handling.
   */
  const classifyError = (error: unknown): SubmitErrorType => {
    // Our own auth sentinel
    if (error instanceof AuthRequiredError) {
      return "session";
    }

    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (/failed to fetch|network|fetch|cors/i.test(message)) {
      return "network";
    }

    if (/auth|session|expired|not authenticated|auth_required|jwt/i.test(message)) {
      return "session";
    }

    if (/database|rls|policy|insert|update|delete/i.test(message)) {
      return "database";
    }

    return "unknown";
  };

  /**
   * Shows appropriate toast based on error type.
   */
  const showErrorToast = useCallback(
    (errorType: SubmitErrorType) => {
      switch (errorType) {
        case "network":
          toast({
            title: "Conexão instável",
            description: "Verifique sua internet e tente novamente.",
            variant: "destructive",
          });
          break;
        case "session":
          toast({
            title: "Sessão expirada",
            description: "Faça login novamente para concluir o cadastro.",
            variant: "destructive",
          });
          options.onSessionExpired?.();
          break;
        case "database":
          toast({
            title: "Erro ao salvar dados",
            description: "Ocorreu um erro no servidor. Tente novamente.",
            variant: "destructive",
          });
          break;
        default:
          toast({
            title: "Erro ao salvar dados",
            description: "Tente novamente mais tarde.",
            variant: "destructive",
          });
      }
    },
    [toast, options]
  );

  /**
   * Builds the documents array for insertion.
   */
  const buildDocumentsPayload = (
    formationId: string,
    partnersToInsert: Array<{ id: string }>,
    socios: Socio[],
    companyDocuments: CompanyDocuments
  ) => {
    const documentsToInsert: Array<{
      company_formation_id: string;
      partner_id?: string;
      document_type: string;
      file_name: string;
      file_url: string;
    }> = [];

    // Company documents
    if (companyDocuments.iptu_url) {
      documentsToInsert.push({
        company_formation_id: formationId,
        document_type: "iptu_capa",
        file_name: companyDocuments.iptu_name || "iptu",
        file_url: companyDocuments.iptu_url,
      });
    }

    if (companyDocuments.avcb_url) {
      documentsToInsert.push({
        company_formation_id: formationId,
        document_type: "avcb",
        file_name: companyDocuments.avcb_name || "avcb",
        file_url: companyDocuments.avcb_url,
      });
    }

    if (companyDocuments.ecpf_url) {
      documentsToInsert.push({
        company_formation_id: formationId,
        document_type: "ecpf",
        file_name: companyDocuments.ecpf_name || "ecpf",
        file_url: companyDocuments.ecpf_url,
      });
    }

    // Partner documents
    for (let i = 0; i < socios.length; i++) {
      const socio = socios[i];
      const partnerId = partnersToInsert[i].id;

      if (socio.documents.rg_url) {
        documentsToInsert.push({
          company_formation_id: formationId,
          partner_id: partnerId,
          document_type: "rg",
          file_name: socio.documents.rg_name || "rg",
          file_url: socio.documents.rg_url,
        });
      }

      if (socio.documents.cnh_url) {
        documentsToInsert.push({
          company_formation_id: formationId,
          partner_id: partnerId,
          document_type: "cnh",
          file_name: socio.documents.cnh_name || "cnh",
          file_url: socio.documents.cnh_url,
        });
      }
    }

    return documentsToInsert;
  };

  /**
   * Builds the partners array for insertion.
   */
  const buildPartnersPayload = (formationId: string, socios: Socio[]) => {
    return socios.map((socio) => ({
      id: crypto.randomUUID(),
      company_formation_id: formationId,
      name: socio.nome,
      rg: socio.rg,
      cpf: socio.cpf.replace(/\D/g, ""),
      cep: socio.cep.replace(/\D/g, ""),
      address: socio.endereco,
      city_state: socio.cidadeUf,
      marital_status: socio.estadoCivil,
      birthplace_city: socio.naturalidadeCidade,
      birthplace_state: socio.naturalidadeEstado,
    }));
  };

  /**
   * Creates a new company formation (used in Index.tsx step 5).
   */
  const createFormation = useCallback(
    async (params: CreateFormationParams, hasEcpfFromForm: boolean): Promise<SubmitResult> => {
      const { leadId, socios, iptu, hasEcpf, companyDocuments } = params;

      if (!leadId) {
        return { success: false, errorType: "unknown", errorMessage: "Lead ID ausente" };
      }

      setIsSubmitting(true);

      try {
        // Validate (and hydrate) session via the provider helper.
        // Do not rely on `auth.user` here, because it can be temporarily null while auth is hydrating,
        // even though a valid session exists in storage.
        let userId: string;
        try {
          userId = await auth.ensureUserId();
        } catch (err) {
          console.warn("[createFormation] ensureUserId failed, attempting fallback refresh:", err);
          
          // Fallback: try refreshing session directly
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session?.user?.id) {
            userId = refreshed.session.user.id;
          } else {
            // Last attempt: getSession
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session?.user?.id) {
              userId = sessionData.session.user.id;
            } else {
              const errorType = classifyError(err);
              showErrorToast(errorType);
              return { success: false, errorType };
            }
          }
        }

        // Generate formation ID client-side
        const formationId = crypto.randomUUID();

        // Insert company formation (retry once if token expired)
        const formationPayload = {
          id: formationId,
          lead_id: leadId,
          iptu: iptu,
          has_ecpf: hasEcpf,
          ecpf_certificate_url: companyDocuments.ecpf_url || null,
          user_id: userId,
        };

        let formationError: unknown | null = null;
        {
          const res = await supabase.from("company_formations").insert(formationPayload);
          formationError = res.error;
        }

        if (formationError) {
          if (isAuthTokenError(formationError)) {
            await supabase.auth.refreshSession();
            const retry = await supabase.from("company_formations").insert(formationPayload);
            formationError = retry.error;
          }

          if (formationError) {
            console.error("Formation error:", formationError);
            throw formationError;
          }
        }

        // Insert partners (retry once if token expired)
        const partnersToInsert = buildPartnersPayload(formationId, socios);
        let partnersError: unknown | null = null;
        {
          const res = await supabase.from("partners").insert(partnersToInsert);
          partnersError = res.error;
        }

        if (partnersError) {
          if (isAuthTokenError(partnersError)) {
            await supabase.auth.refreshSession();
            const retry = await supabase.from("partners").insert(partnersToInsert);
            partnersError = retry.error;
          }

          if (partnersError) {
            console.error("Partners error:", partnersError);
            throw partnersError;
          }
        }

        // Insert documents
        const documentsToInsert = buildDocumentsPayload(formationId, partnersToInsert, socios, companyDocuments);
        if (documentsToInsert.length > 0) {
          const { error: docsError } = await supabase.from("documents").insert(documentsToInsert);
          if (docsError) {
            console.error("Documents error:", docsError);
            // Non-blocking: documents are secondary
          }
        }

        // Navigate based on e-CPF selection
        if (hasEcpfFromForm) {
          navigate("/acesso-portal");
        } else {
          navigate("/biometria");
        }

        return { success: true };
      } catch (error) {
        console.error("Error creating company formation:", error);
        const errorType = classifyError(error);
        showErrorToast(errorType);
        return { success: false, errorType, errorMessage: String(error) };
      } finally {
        setIsSubmitting(false);
      }
    },
    [auth, navigate, showErrorToast]
  );

  /**
   * Updates an existing company formation (used in FormularioAbertura.tsx).
   */
  const updateFormation = useCallback(
    async (params: UpdateFormationParams, hasEcpfFromForm: boolean): Promise<SubmitResult> => {
      const { formationId, socios, iptu, hasEcpf, companyDocuments } = params;

      if (!formationId) {
        return { success: false, errorType: "unknown", errorMessage: "Formation ID ausente" };
      }

      setIsSubmitting(true);

      try {
        // Validate session
        try {
          await auth.ensureUserId();
        } catch (err) {
          const errorType = classifyError(err);
          showErrorToast(errorType);
          return { success: false, errorType };
        }

        // Update company formation
        const { error: formationError } = await supabase
          .from("company_formations")
          .update({
            iptu: iptu,
            has_ecpf: hasEcpf,
            ecpf_certificate_url: companyDocuments.ecpf_url || null,
          })
          .eq("id", formationId);

        if (formationError) {
          console.error("Formation update error:", formationError);
          throw formationError;
        }

        // Delete existing partners and documents to re-insert
        await supabase.from("partners").delete().eq("company_formation_id", formationId);
        await supabase.from("documents").delete().eq("company_formation_id", formationId);

        // Insert partners
        const partnersToInsert = buildPartnersPayload(formationId, socios);
        const { error: partnersError } = await supabase.from("partners").insert(partnersToInsert);

        if (partnersError) {
          console.error("Partners error:", partnersError);
          throw partnersError;
        }

        // Insert documents
        const documentsToInsert = buildDocumentsPayload(formationId, partnersToInsert, socios, companyDocuments);
        if (documentsToInsert.length > 0) {
          const { error: docsError } = await supabase.from("documents").insert(documentsToInsert);
          if (docsError) {
            console.error("Documents error:", docsError);
            // Non-blocking: documents are secondary
          }
        }

        toast({
          title: "Dados atualizados!",
          description: "Suas informações foram salvas com sucesso.",
        });

        // Navigate based on e-CPF selection
        if (hasEcpfFromForm) {
          navigate("/acesso-portal");
        } else {
          navigate("/biometria");
        }

        return { success: true };
      } catch (error) {
        console.error("Error updating company formation:", error);
        const errorType = classifyError(error);
        showErrorToast(errorType);
        return { success: false, errorType, errorMessage: String(error) };
      } finally {
        setIsSubmitting(false);
      }
    },
    [auth, navigate, toast, showErrorToast]
  );

  return {
    isSubmitting,
    createFormation,
    updateFormation,
  };
}
