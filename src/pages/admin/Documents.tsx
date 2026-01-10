import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Eye, Search, FileText, User, Building } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  created_at: string;
  company_formation_id: string;
  partner_id: string | null;
  company_formations?: {
    id: string;
    iptu: string;
    leads?: {
      name: string;
      email: string;
    };
  };
  partners?: {
    name: string;
  };
}

const documentTypeLabels: Record<string, string> = {
  rg: "RG",
  cnh: "CNH",
  iptu_capa: "Capa do IPTU",
  avcb: "AVCB",
  ecpf: "e-CPF",
};

const Documents = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["admin-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          company_formations (
            id,
            iptu,
            leads (
              name,
              email
            )
          ),
          partners (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Document[];
    },
  });

  const handleViewDocument = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Error getting signed URL:", error);
      toast({
        title: "Erro ao abrir documento",
        description: "Não foi possível gerar o link do documento.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Erro ao baixar documento",
        description: "Não foi possível baixar o documento.",
        variant: "destructive",
      });
    }
  };

  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch =
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.company_formations?.leads?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.company_formations?.leads?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.partners?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || doc.document_type === filterType;

    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">
          Visualize todos os documentos enviados pelos usuários
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou arquivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="rg">RG</SelectItem>
            <SelectItem value="cnh">CNH</SelectItem>
            <SelectItem value="iptu_capa">Capa do IPTU</SelectItem>
            <SelectItem value="avcb">AVCB</SelectItem>
            <SelectItem value="ecpf">e-CPF</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="h-4 w-4" />
            Total
          </div>
          <p className="text-2xl font-bold">{documents?.length || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <User className="h-4 w-4" />
            RG/CNH
          </div>
          <p className="text-2xl font-bold">
            {documents?.filter((d) => d.document_type === "rg" || d.document_type === "cnh").length || 0}
          </p>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Building className="h-4 w-4" />
            IPTU/AVCB
          </div>
          <p className="text-2xl font-bold">
            {documents?.filter((d) => d.document_type === "iptu_capa" || d.document_type === "avcb").length || 0}
          </p>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="h-4 w-4" />
            e-CPF
          </div>
          <p className="text-2xl font-bold">
            {documents?.filter((d) => d.document_type === "ecpf").length || 0}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sócio</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum documento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments?.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Badge variant="secondary">
                      {documentTypeLabels[doc.document_type] || doc.document_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {doc.file_name}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{doc.company_formations?.leads?.name || "-"}</p>
                      <p className="text-sm text-muted-foreground">
                        {doc.company_formations?.leads?.email || "-"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{doc.partners?.name || "-"}</TableCell>
                  <TableCell>
                    {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDocument(doc.file_url)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadDocument(doc.file_url, doc.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Documents;
