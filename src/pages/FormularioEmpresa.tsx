import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyFormationSubmit } from "@/hooks/useCompanyFormationSubmit";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  StepCompanyForm,
  Socio,
  CompanyDocuments,
  createEmptySocio,
} from "@/components/checkout/StepCompanyForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  loadRegistrationProgress,
  clearRegistrationProgress,
} from "@/lib/registrationStorage";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

const FormularioEmpresa = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [hasExistingFormation, setHasExistingFormation] = useState(false);

  // Company Form State
  const [socios, setSocios] = useState<Socio[]>([createEmptySocio()]);
  const [iptu, setIptu] = useState("");
  const [hasEcpf, setHasEcpf] = useState(false);
  const [companyDocuments, setCompanyDocuments] = useState<CompanyDocuments>({});

  // Session expiry warning
  const [sessionExpiringWarning, setSessionExpiringWarning] = useState(false);
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hook for submission
  const { isSubmitting, createFormation } = useCompanyFormationSubmit({
    onSessionExpired: () => {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para continuar.",
        variant: "destructive",
      });
      navigate("/login");
    },
  });

  // Session check (proactive refresh)
  useEffect(() => {
    const checkAndRefreshSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.expires_at) {
          setSessionExpiringWarning(false);
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        const timeLeft = session.expires_at - now;

        if (timeLeft < 600 && timeLeft > 0) {
          // Only warn; avoid proactive refresh here to prevent refresh-token rotation races.
          setSessionExpiringWarning(true);
        } else if (timeLeft <= 0) {
          setSessionExpiringWarning(true);
        } else {
          setSessionExpiringWarning(false);
        }
      } catch (err) {
        console.error("[FormularioEmpresa] Session check error:", err);
      }
    };

    checkAndRefreshSession();
    sessionCheckRef.current = setInterval(checkAndRefreshSession, 5 * 60 * 1000);

    return () => {
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
      }
    };
  }, []);

  // Load user's leads and check for existing formations
  useEffect(() => {
    const loadUserData = async () => {
      if (auth.isLoading) return;

      // Wait for session to be available (ProtectedRoute handles the redirect)
      if (!auth.user) {
        setIsLoadingPage(false);
        return;
      }

      try {
        // Check for existing company formation with partners
        const { data: existingFormation } = await supabase
          .from("company_formations")
          .select(`
            id,
            lead_id,
            iptu,
            has_ecpf,
            partners (id)
          `)
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingFormation) {
          const partners = existingFormation.partners as { id: string }[] | null;
          if (partners && partners.length > 0) {
            // User already completed the form
            setHasExistingFormation(true);
            clearRegistrationProgress();
            navigate("/acesso-portal");
            return;
          }

          // Has formation but no partners - pre-fill data
          setSelectedLeadId(existingFormation.lead_id);
          setIptu(existingFormation.iptu || "");
          setHasEcpf(existingFormation.has_ecpf || false);
        }

        // Load leads from localStorage progress first
        const storedProgress = loadRegistrationProgress();
        if (storedProgress?.leadId) {
          setSelectedLeadId(storedProgress.leadId);
        }

        // Fetch leads linked to user's subscriptions
        const { data: subscriptions } = await supabase
          .from("subscriptions")
          .select("lead_id")
          .eq("user_id", auth.user.id);

        if (subscriptions && subscriptions.length > 0) {
          const leadIds = subscriptions.map((s) => s.lead_id);
          
          const { data: userLeads } = await supabase
            .from("leads")
            .select("*")
            .in("id", leadIds);

          if (userLeads && userLeads.length > 0) {
            setLeads(userLeads);
            
            // Auto-select if only one lead or if matches stored progress
            if (userLeads.length === 1) {
              setSelectedLeadId(userLeads[0].id);
            } else if (storedProgress?.leadId) {
              const matchingLead = userLeads.find((l) => l.id === storedProgress.leadId);
              if (matchingLead) {
                setSelectedLeadId(matchingLead.id);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Tente novamente mais tarde.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingPage(false);
      }
    };

    loadUserData();
  }, [auth.isLoading, auth.user, navigate, toast]);

  const handleSubmit = async (hasEcpfFromForm: boolean) => {
    if (!selectedLeadId) {
      toast({
        title: "Selecione um lead",
        description: "É necessário selecionar um cadastro para continuar.",
        variant: "destructive",
      });
      return;
    }

    try {
      await auth.ensureUserId();
    } catch {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para concluir o cadastro.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    const result = await createFormation(
      {
        leadId: selectedLeadId,
        socios,
        iptu,
        hasEcpf,
        companyDocuments,
      },
      hasEcpfFromForm
    );

    if (result.success) {
      clearRegistrationProgress();
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  if (isLoadingPage || auth.isLoading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasExistingFormation) {
    return null; // Will redirect
  }

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <div className="min-h-screen gradient-hero">
      <div className="container max-w-3xl py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Dados para abertura da empresa
          </h1>
          <p className="text-muted-foreground">
            Complete as informações dos sócios para finalizar o cadastro
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-elegant p-6 sm:p-8">
          {/* Lead Selector */}
          {leads.length > 1 && (
            <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30">
              <Label className="text-foreground mb-2 block">
                Selecione o cadastro
              </Label>
              <Select
                value={selectedLeadId || ""}
                onValueChange={setSelectedLeadId}
              >
                <SelectTrigger className="h-11 bg-card">
                  <SelectValue placeholder="Selecione um cadastro" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name} - {lead.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected Lead Info */}
          {selectedLead && (
            <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground mb-1">Cadastro selecionado:</p>
              <p className="font-medium text-foreground">{selectedLead.name}</p>
              <p className="text-sm text-muted-foreground">{selectedLead.email}</p>
            </div>
          )}

          {/* No leads warning */}
          {leads.length === 0 && !selectedLeadId && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhum cadastro encontrado. Complete o fluxo de cadastro primeiro.
              </AlertDescription>
            </Alert>
          )}

          {/* Session Warning */}
          {sessionExpiringWarning && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Sua sessão está expirando. Salve seu progresso ou faça login novamente.
              </AlertDescription>
            </Alert>
          )}

          {/* Company Form - only show if lead is selected */}
          {selectedLeadId && (
            <StepCompanyForm
              socios={socios}
              iptu={iptu}
              hasEcpf={hasEcpf}
              companyDocuments={companyDocuments}
              onUpdateSocios={setSocios}
              onUpdateIptu={setIptu}
              onUpdateHasEcpf={setHasEcpf}
              onUpdateCompanyDocuments={setCompanyDocuments}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FormularioEmpresa;
