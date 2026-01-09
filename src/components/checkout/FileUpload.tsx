import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  label: string;
  documentType: string;
  required?: boolean;
  value?: string;
  onChange: (url: string | null, fileName: string | null) => void;
  disabled?: boolean;
}

export const FileUpload = ({
  label,
  documentType,
  required = false,
  value,
  onChange,
  disabled,
}: FileUploadProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 10MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Use PDF, JPG, PNG ou WEBP",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${documentType}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      setFileName(file.name);
      onChange(urlData.publicUrl, file.name);

      toast({
        title: "Arquivo enviado",
        description: file.name,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro ao enviar arquivo",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setFileName(null);
    onChange(null, null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {value || fileName ? (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/50">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-foreground truncate flex-1">
            {fileName || "Arquivo enviado"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || isUploading}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 w-5 h-5 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="mr-2 w-5 h-5" />
              Selecionar arquivo
            </>
          )}
        </Button>
      )}
    </div>
  );
};
