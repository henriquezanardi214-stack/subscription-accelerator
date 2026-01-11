import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ExternalLink, Loader2 } from "lucide-react";

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
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Cadastro concluído com sucesso!
          </CardTitle>
          <CardDescription className="text-base">
            Seu processo de abertura de empresa está sendo realizado pela nossa equipe. 
            Em breve você receberá atualizações por e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Enquanto isso, você já pode acessar o portal do cliente para acompanhar o andamento:
            </p>
          </div>
          
          <Button 
            className="w-full gradient-primary" 
            size="lg"
            onClick={() => window.open("https://portal.contabiliadigital.com.br/", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Acessar Portal do Cliente
          </Button>

          <p className="text-xs text-muted-foreground">
            O portal estará disponível para acesso com suas credenciais assim que o processo for finalizado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcessoPortal;
