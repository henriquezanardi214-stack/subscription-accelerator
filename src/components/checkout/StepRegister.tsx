import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface StepRegisterProps {
  email: string;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export const StepRegister = ({
  email,
  onBack,
  onNext,
  isLoading: externalLoading,
}: StepRegisterProps) => {
  const { toast } = useToast();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: email,
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.password) {
      newErrors.password = "Senha é obrigatória";
    } else if (formData.password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Senhas não coincidem";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        // Confirma que a sessão foi persistida/hidratada antes de avançar
        await auth.ensureUserId();

        toast({
          title: "Login realizado!",
          description: "Continue o cadastro da sua empresa.",
        });
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        // Com auto-confirmação habilitada, a sessão deve ficar disponível imediatamente
        await auth.ensureUserId();

        toast({
          title: "Conta criada!",
          description: "Continue o cadastro da sua empresa.",
        });
      }

      // Pequeno delay para evitar corrida com a hidratação do AuthProvider
      await new Promise((resolve) => setTimeout(resolve, 250));

      onNext();
    } catch (error: unknown) {
      console.error("Auth error:", error);
      const errorMessage = error instanceof Error ? error.message : "Tente novamente.";
      toast({
        title: isLogin ? "Erro no login" : "Erro ao criar conta",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || externalLoading;

  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {isLogin ? "Acesse sua conta" : "Crie sua conta"}
        </h2>
        <p className="text-muted-foreground">
          {isLogin
            ? "Entre para continuar de onde parou"
            : "Cadastre-se para salvar seu progresso"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label className="text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email
          </Label>
          <Input
            type="email"
            placeholder="seu@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="h-12 bg-card"
            disabled={loading}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Senha
          </Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="h-12 bg-card pr-12"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}
        </div>

        {!isLogin && (
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Confirmar Senha
            </Label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Confirme sua senha"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="h-12 bg-card"
              disabled={loading}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline text-sm"
            disabled={loading}
          >
            {isLogin
              ? "Não tem conta? Cadastre-se"
              : "Já tem conta? Faça login"}
          </button>
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 h-12 font-semibold"
            disabled={loading}
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Voltar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                {isLogin ? "Entrando..." : "Criando conta..."}
              </>
            ) : (
              <>
                {isLogin ? "Entrar" : "Criar conta"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
