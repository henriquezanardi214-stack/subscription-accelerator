import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ShieldCheck, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Session } from "@supabase/supabase-js";

interface SessionStatus {
  status: "valid" | "expiring" | "expired" | "none";
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

const getSessionStatus = (session: Session | null): SessionStatus => {
  if (!session) {
    return { status: "none", label: "Sem sessão", variant: "destructive" };
  }

  const expiresAt = session.expires_at;
  if (!expiresAt) {
    return { status: "valid", label: "Válida", variant: "default" };
  }

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = expiresAt - now;

  if (timeLeft < 0) {
    return { status: "expired", label: "Expirada", variant: "destructive" };
  }
  if (timeLeft < 600) {
    // < 10 minutes
    return { status: "expiring", label: "Expirando", variant: "secondary" };
  }
  return { status: "valid", label: "Válida", variant: "default" };
};

const formatTimeRemaining = (expiresAt: number | undefined): string => {
  if (!expiresAt) return "N/A";

  const now = Math.floor(Date.now() / 1000);
  const seconds = expiresAt - now;

  if (seconds < 0) return "Expirado";

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${seconds % 60}s`;
};

const formatLastRefresh = (issuedAt: number | undefined): string => {
  if (!issuedAt) return "N/A";

  const date = new Date(issuedAt * 1000);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const SessionDiagnostics = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);

      if (!currentSession?.user?.id) return;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentSession.user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
    };

    checkAdmin();
  }, []);

  // Auto-refresh session status every 10 seconds
  useEffect(() => {
    if (!isAdmin) return;

    const interval = setInterval(async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);
      setLastUpdate(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Attempt to refresh the session
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("[SessionDiagnostics] Refresh failed:", error.message);
      } else {
        setSession(data.session);
      }
    } catch (err) {
      console.error("[SessionDiagnostics] Refresh error:", err);
    } finally {
      setLastUpdate(new Date());
      setIsRefreshing(false);
    }
  }, []);

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  const sessionStatus = getSessionStatus(session);

  const StatusIcon = () => {
    switch (sessionStatus.status) {
      case "valid":
        return <ShieldCheck className="h-4 w-4 text-primary" />;
      case "expiring":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "expired":
      case "none":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <Card className="mb-6 border-dashed border-primary/50 bg-primary/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-primary/10 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <StatusIcon />
              <span className="text-sm font-medium text-foreground">
                🔧 Diagnóstico de Sessão (Admin)
              </span>
              <Badge variant={sessionStatus.variant}>{sessionStatus.label}</Badge>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">User ID:</span>
                <p className="font-mono text-xs break-all">
                  {session?.user?.id || "Não autenticado"}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="text-foreground truncate">
                  {session?.user?.email || "N/A"}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground">Expira em:</span>
                <p
                  className={`font-medium ${
                    sessionStatus.status === "expiring"
                      ? "text-amber-600"
                      : sessionStatus.status === "expired"
                        ? "text-destructive"
                        : "text-foreground"
                  }`}
                >
                  {formatTimeRemaining(session?.expires_at)}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground">Emitido às:</span>
                <p className="text-foreground">
                  {formatLastRefresh(session?.expires_at ? session.expires_at - 3600 : undefined)}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground">Última verificação:</span>
                <p className="text-foreground">
                  {lastUpdate.toLocaleTimeString("pt-BR")}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground">Provider:</span>
                <p className="text-foreground">
                  {session?.user?.app_metadata?.provider || "N/A"}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="w-full"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
                />
                {isRefreshing ? "Atualizando..." : "Forçar atualização da sessão"}
              </Button>
            </div>

            {sessionStatus.status === "expiring" && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400">
                ⚠️ A sessão expira em menos de 10 minutos. Clique em "Forçar
                atualização" para renovar.
              </div>
            )}

            {sessionStatus.status === "expired" && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                ❌ Sessão expirada! O usuário precisa fazer login novamente.
              </div>
            )}

            {sessionStatus.status === "none" && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                ❌ Nenhuma sessão ativa. O usuário não está autenticado.
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
