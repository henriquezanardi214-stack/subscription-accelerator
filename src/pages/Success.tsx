import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Success = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center animate-slide-up">
        <div className="bg-card rounded-2xl p-8 sm:p-12 shadow-elegant">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
            <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Cadastro realizado com sucesso!
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            Obrigado por escolher nossos serviços. Em breve nossa equipe entrará
            em contato para dar continuidade ao processo de abertura da sua
            empresa.
          </p>

          <Button
            onClick={() => navigate("/")}
            className="h-12 px-8 font-semibold gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Voltar ao início
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Success;
