import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FormationRow {
  id: string;
  created_at: string;
  lead_id: string;
  iptu: string;
  has_ecpf: boolean | null;
  user_id: string | null;
}

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface FormationVM extends FormationRow {
  lead?: LeadRow;
  partnersCount: number;
  documentsCount: number;
}

const Formations = () => {
  const [rows, setRows] = useState<FormationVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      const { data: formations, error: formationsError } = await supabase
        .from("company_formations")
        .select("id, created_at, lead_id, iptu, has_ecpf, user_id")
        .order("created_at", { ascending: false })
        .limit(200);

      if (formationsError) {
        console.error("Error fetching formations:", formationsError);
        setRows([]);
        setLoading(false);
        return;
      }

      const formationList = (formations || []) as FormationRow[];
      if (formationList.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const formationIds = formationList.map((f) => f.id);
      const leadIds = Array.from(new Set(formationList.map((f) => f.lead_id)));

      const [leadsRes, partnersRes, docsRes] = await Promise.all([
        supabase.from("leads").select("id, name, email, phone").in("id", leadIds),
        supabase.from("partners").select("id, company_formation_id").in("company_formation_id", formationIds),
        supabase.from("documents").select("id, company_formation_id").in("company_formation_id", formationIds),
      ]);

      if (leadsRes.error) console.error("Error fetching leads:", leadsRes.error);
      if (partnersRes.error) console.error("Error fetching partners:", partnersRes.error);
      if (docsRes.error) console.error("Error fetching documents:", docsRes.error);

      const leadsMap = new Map((leadsRes.data as LeadRow[] | null)?.map((l) => [l.id, l]) || []);

      const partnersCount = new Map<string, number>();
      (partnersRes.data as Array<{ company_formation_id: string }> | null)?.forEach((p) => {
        partnersCount.set(p.company_formation_id, (partnersCount.get(p.company_formation_id) || 0) + 1);
      });

      const docsCount = new Map<string, number>();
      (docsRes.data as Array<{ company_formation_id: string }> | null)?.forEach((d) => {
        docsCount.set(d.company_formation_id, (docsCount.get(d.company_formation_id) || 0) + 1);
      });

      const viewModel: FormationVM[] = formationList.map((f) => ({
        ...f,
        lead: leadsMap.get(f.lead_id),
        partnersCount: partnersCount.get(f.id) || 0,
        documentsCount: docsCount.get(f.id) || 0,
      }));

      setRows(viewModel);
      setLoading(false);
    };

    void run();
  }, []);

  const total = rows.length;
  const withEcpf = useMemo(() => rows.filter((r) => r.has_ecpf).length, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Aberturas</h1>
        <div className="flex gap-2">
          <Badge variant="secondary">{total} total</Badge>
          <Badge variant="outline">{withEcpf} com e-CPF</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulários enviados (Step 5)</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma abertura encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>IPTU</TableHead>
                  <TableHead>Sócios</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>e-CPF</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{r.lead?.name || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">{r.lead?.email}</div>
                        <div className="text-xs text-muted-foreground">{r.lead?.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.iptu}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.partnersCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.documentsCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.has_ecpf ? "default" : "secondary"}>
                        {r.has_ecpf ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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

export default Formations;
