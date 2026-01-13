import { Button } from "@/components/ui/button";
import { Fingerprint, CheckCircle, ExternalLink, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Biometria = () => {
  const navigate = useNavigate();

  const handleAgendarBiometria = () => {
    window.open("https://www.soluti.com.br/", "_blank");
  };

  const handleVerProcesso = () => {
    navigate("/acesso-portal");
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-card rounded-2xl shadow-elegant p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Fingerprint className="w-10 h-10 text-primary" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Ativação do e-CPF
          </h1>

          <p className="text-muted-foreground mb-6 leading-relaxed">
            Para concluir a abertura da sua empresa, você precisará fazer a 
            biometria para ativar seu e-CPF. Não se preocupe, esse processo 
            <strong className="text-foreground"> não tem nenhum custo adicional</strong>.
          </p>

          <div className="bg-muted/50 rounded-xl p-4 mb-8">
            <h3 className="font-semibold text-foreground mb-3 flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              O que você precisa saber:
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                O processo é rápido e simples
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Você precisará comparecer a um ponto de atendimento
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Leve um documento com foto (RG ou CNH)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Sem custos adicionais
              </li>
            </ul>
          </div>

          <Button
            onClick={handleAgendarBiometria}
            size="lg"
            className="w-full h-14 gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity text-lg"
          >
            Agendar biometria
            <ExternalLink className="ml-2 w-5 h-5" />
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            Você será redirecionado para o site da Soluti
          </p>

          <Button
            onClick={handleVerProcesso}
            variant="outline"
            size="lg"
            className="w-full h-12 mt-4"
          >
            <Eye className="mr-2 w-5 h-5" />
            Ver processo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Biometria;
