import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Qualification {
  id: string;
  area_of_operation: string;
  monthly_revenue: string;
  company_segment: string;
  is_qualified: boolean;
  lead_id: string;
  created_at: string;
  lead?: {
    name: string;
    email: string;
  };
}

const Qualifications = () => {
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQualifications = async () => {
      const { data: qualData, error } = await supabase
        .from("qualifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && qualData) {
        // Fetch leads separately to get names
        const leadIds = qualData.map(q => q.lead_id);
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, name, email")
          .in("id", leadIds);

        const leadsMap = new Map(leadsData?.map(l => [l.id, l]) || []);
        
        const enrichedData = qualData.map(q => ({
          ...q,
          lead: leadsMap.get(q.lead_id)
        }));

        setQualifications(enrichedData);
      }
      setLoading(false);
    };

    fetchQualifications();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const qualified = qualifications.filter(q => q.is_qualified).length;
  const disqualified = qualifications.length - qualified;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Qualificações</h1>
        <div className="flex gap-2">
          <Badge variant="default">{qualified} qualificados</Badge>
          <Badge variant="destructive">{disqualified} desqualificados</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Qualificações</CardTitle>
        </CardHeader>
        <CardContent>
          {qualifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma qualificação cadastrada ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Área de Atuação</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualifications.map((qual) => (
                  <TableRow key={qual.id}>
                    <TableCell className="font-medium">
                      {qual.lead?.name || "N/A"}
                    </TableCell>
                    <TableCell>{qual.company_segment}</TableCell>
                    <TableCell>{qual.area_of_operation}</TableCell>
                    <TableCell>{qual.monthly_revenue}</TableCell>
                    <TableCell>
                      {qual.is_qualified ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Qualificado
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Desqualificado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(qual.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Qualifications;
