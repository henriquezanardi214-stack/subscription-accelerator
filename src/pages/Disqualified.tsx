import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Disqualified = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center animate-slide-up">
        <div className="bg-card rounded-2xl p-8 sm:p-12 shadow-elegant">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-muted-foreground" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Não conseguimos atender sua empresa
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            Em breve nosso parceiro entrará em contato com você para ajudar no
            seu processo de abertura de empresa.
          </p>

          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="h-12 px-8 font-semibold"
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Disqualified;
