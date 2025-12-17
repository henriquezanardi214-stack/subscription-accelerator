import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompanyFormation {
  id: string;
  iptu: string;
  lead_id: string;
  created_at: string;
  lead?: {
    name: string;
    email: string;
  };
  partners?: {
    id: string;
    name: string;
    cpf: string;
    city_state: string;
  }[];
}

const Payments = () => {
  const [formations, setFormations] = useState<CompanyFormation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFormations = async () => {
      const { data: formData, error } = await supabase
        .from("company_formations")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && formData) {
        // Fetch leads and partners
        const leadIds = formData.map(f => f.lead_id);
        const formationIds = formData.map(f => f.id);

        const [leadsRes, partnersRes] = await Promise.all([
          supabase.from("leads").select("id, name, email").in("id", leadIds),
          supabase.from("partners").select("*").in("company_formation_id", formationIds),
        ]);

        const leadsMap = new Map(leadsRes.data?.map(l => [l.id, l]) || []);
        const partnersMap = new Map<string, typeof partnersRes.data>();
        
        partnersRes.data?.forEach(p => {
          const existing = partnersMap.get(p.company_formation_id) || [];
          existing.push(p);
          partnersMap.set(p.company_formation_id, existing);
        });

        const enrichedData = formData.map(f => ({
          ...f,
          lead: leadsMap.get(f.lead_id),
          partners: partnersMap.get(f.id) || [],
        }));

        setFormations(enrichedData);
      }
      setLoading(false);
    };

    fetchFormations();
  }, []);

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
        <h1 className="text-3xl font-bold">Pagamentos / Empresas</h1>
        <Badge variant="secondary">{formations.length} total</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresas Formadas</CardTitle>
        </CardHeader>
        <CardContent>
          {formations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma empresa formada ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>IPTU</TableHead>
                  <TableHead>Sócios</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formations.map((formation) => (
                  <TableRow key={formation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{formation.lead?.name || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">
                          {formation.lead?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formation.iptu}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {formation.partners?.map((partner) => (
                          <div key={partner.id} className="flex items-center gap-2">
                            <Building className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {partner.name} ({partner.cpf})
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(formation.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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

export default Payments;
