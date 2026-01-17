import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  asaas_customer_id: string;
  asaas_subscription_id: string;
  billing_type: string;
  plan_name: string | null;
  plan_value: number;
  status: string;
  created_at: string;
  lead_id: string;
  lead?: {
    name: string;
    email: string;
    phone: string;
  };
}

const Payments = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      const { data: subsData, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && subsData) {
        // Fetch leads
        const leadIds = subsData.map(s => s.lead_id);

        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, name, email, phone")
          .in("id", leadIds);

        const leadsMap = new Map(leadsData?.map(l => [l.id, l]) || []);

        const enrichedData = subsData.map(s => ({
          ...s,
          lead: leadsMap.get(s.lead_id),
        }));

        setSubscriptions(enrichedData);
      }
      setLoading(false);
    };

    fetchSubscriptions();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      PENDING: "secondary",
      OVERDUE: "destructive",
      CANCELED: "outline",
    };
    const labels: Record<string, string> = {
      ACTIVE: "Ativo",
      PENDING: "Pendente",
      OVERDUE: "Atrasado",
      CANCELED: "Cancelado",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getBillingTypeBadge = (billingType: string) => {
    const labels: Record<string, string> = {
      BOLETO: "Boleto",
      PIX: "PIX",
      CREDIT_CARD: "Cartão",
    };
    return (
      <Badge variant="outline">
        {labels[billingType] || billingType}
      </Badge>
    );
  };

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
        <h1 className="text-3xl font-bold">Pagamentos</h1>
        <Badge variant="secondary">{subscriptions.length} assinaturas</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma assinatura encontrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ID Asaas</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sub.lead?.name || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">
                          {sub.lead?.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sub.lead?.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        {sub.plan_name || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {sub.plan_value.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {getBillingTypeBadge(sub.billing_type)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sub.status)}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {sub.asaas_subscription_id}
                      </code>
                    </TableCell>
                    <TableCell>
                      {format(new Date(sub.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
