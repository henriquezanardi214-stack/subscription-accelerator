import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ExternalLink, Loader2, Clock, FileText, Building2, FileCheck, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const progressSteps = [
  { 
    title: "Cadastro recebido", 
    description: "Seus dados foram enviados com sucesso",
    icon: CheckCircle,
    status: "completed" as const
  },
  { 
    title: "Análise de documentos", 
    description: "Verificando documentação enviada",
    icon: FileText,
    status: "current" as const
  },
  { 
    title: "Registro na Junta", 
    description: "Protocolo na Junta Comercial",
    icon: Building2,
    status: "pending" as const
  },
  { 
    title: "Emissão do CNPJ", 
    description: "Cadastro na Receita Federal",
    icon: FileCheck,
    status: "pending" as const
  },
  { 
    title: "Inscrições fiscais", 
    description: "Municipal e/ou Estadual",
    icon: BadgeCheck,
    status: "pending" as const
  },
];

type StepStatus = "completed" | "current" | "pending";

const ProgressStep = ({ 
  step, 
  index, 
  isLast 
}: { 
  step: typeof progressSteps[0]; 
  index: number; 
  isLast: boolean;
}) => {
  const Icon = step.icon;
  const isCompleted = step.status === "completed";
  const isCurrent = step.status === "current";

  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
            isCompleted && "bg-green-500 text-white",
            isCurrent && "gradient-primary text-primary-foreground shadow-glow animate-pulse",
            !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
          )}
        >
          {isCompleted ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 h-12 mt-2 transition-all duration-500",
              isCompleted ? "bg-green-500" : "bg-muted"
            )}
          />
        )}
      </div>
      <div className="pt-2">
        <p
          className={cn(
            "text-sm font-medium transition-colors",
            (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {step.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {step.description}
        </p>
        {isCurrent && (
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-primary" />
            <span className="text-xs text-primary font-medium">Em andamento</span>
          </div>
        )}
      </div>
    </div>
  );
};

const AcessoPortal = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Cadastro concluído com sucesso!
          </CardTitle>
          <CardDescription className="text-base">
            Seu processo de abertura de empresa está sendo realizado pela nossa equipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/30 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Progresso da abertura
            </h3>
            <div className="space-y-0">
              {progressSteps.map((step, index) => (
                <ProgressStep 
                  key={index} 
                  step={step} 
                  index={index} 
                  isLast={index === progressSteps.length - 1} 
                />
              ))}
            </div>
          </div>
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Acompanhe o andamento completo no portal do cliente:
            </p>
            
            <Button 
              className="w-full gradient-primary" 
              size="lg"
              onClick={() => window.open("https://portal.contabiliadigital.com.br/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Acessar Portal do Cliente
            </Button>

            <p className="text-xs text-muted-foreground">
              Em breve você receberá atualizações por e-mail sobre cada etapa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcessoPortal;
