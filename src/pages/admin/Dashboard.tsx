import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  ClipboardCheck, 
  Building, 
  Loader2, 
  TrendingUp, 
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock
} from "lucide-react";
import { format, subDays, startOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";

interface Stats {
  leads: number;
  leadsThisWeek: number;
  leadsLastWeek: number;
  qualifications: number;
  qualificationsQualified: number;
  companyFormations: number;
  documents: number;
  subscriptions: number;
  subscriptionsActive: number;
}

interface RecentActivity {
  id: string;
  type: "lead" | "qualification" | "formation" | "subscription";
  title: string;
  subtitle: string;
  created_at: string;
}

interface DailyData {
  date: string;
  leads: number;
  qualifications: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    leads: 0,
    leadsThisWeek: 0,
    leadsLastWeek: 0,
    qualifications: 0,
    qualificationsQualified: 0,
    companyFormations: 0,
    documents: 0,
    subscriptions: 0,
    subscriptionsActive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [chartData, setChartData] = useState<DailyData[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const weekAgo = subDays(now, 7);
      const twoWeeksAgo = subDays(now, 14);

      const [
        leadsRes,
        leadsThisWeekRes,
        leadsLastWeekRes,
        qualRes,
        qualQualifiedRes,
        compRes,
        docsRes,
        subsRes,
        subsActiveRes,
      ] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo.toISOString()),
        supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", twoWeeksAgo.toISOString())
          .lt("created_at", weekAgo.toISOString()),
        supabase.from("qualifications").select("id", { count: "exact", head: true }),
        supabase.from("qualifications").select("id", { count: "exact", head: true })
          .eq("is_qualified", true),
        supabase.from("company_formations").select("id", { count: "exact", head: true }),
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true })
          .eq("status", "ACTIVE"),
      ]);

      setStats({
        leads: leadsRes.count || 0,
        leadsThisWeek: leadsThisWeekRes.count || 0,
        leadsLastWeek: leadsLastWeekRes.count || 0,
        qualifications: qualRes.count || 0,
        qualificationsQualified: qualQualifiedRes.count || 0,
        companyFormations: compRes.count || 0,
        documents: docsRes.count || 0,
        subscriptions: subsRes.count || 0,
        subscriptionsActive: subsActiveRes.count || 0,
      });

      // Fetch recent activities
      const [recentLeads, recentQuals, recentFormations] = await Promise.all([
        supabase.from("leads").select("id, name, email, created_at")
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("qualifications").select("id, is_qualified, created_at, lead_id")
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("company_formations").select("id, iptu, created_at")
          .order("created_at", { ascending: false }).limit(3),
      ]);

      // Get lead names for qualifications
      const leadIds = recentQuals.data?.map(q => q.lead_id) || [];
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name")
        .in("id", leadIds);
      const leadsMap = new Map(leadsData?.map(l => [l.id, l.name]) || []);

      const activities: RecentActivity[] = [
        ...(recentLeads.data?.map(lead => ({
          id: lead.id,
          type: "lead" as const,
          title: lead.name,
          subtitle: "Novo lead cadastrado",
          created_at: lead.created_at,
        })) || []),
        ...(recentQuals.data?.map(qual => ({
          id: qual.id,
          type: "qualification" as const,
          title: leadsMap.get(qual.lead_id) || "Lead",
          subtitle: qual.is_qualified ? "Qualificado" : "Desqualificado",
          created_at: qual.created_at,
        })) || []),
        ...(recentFormations.data?.map(form => ({
          id: form.id,
          type: "formation" as const,
          title: `IPTU: ${form.iptu}`,
          subtitle: "Nova empresa formada",
          created_at: form.created_at,
        })) || []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
       .slice(0, 8);

      setRecentActivities(activities);

      // Fetch chart data (last 14 days)
      const fourteenDaysAgo = subDays(now, 14);
      const [leadsDaily, qualsDaily] = await Promise.all([
        supabase.from("leads")
          .select("created_at")
          .gte("created_at", fourteenDaysAgo.toISOString()),
        supabase.from("qualifications")
          .select("created_at")
          .gte("created_at", fourteenDaysAgo.toISOString()),
      ]);

      // Build chart data
      const dailyMap = new Map<string, { leads: number; qualifications: number }>();
      for (let i = 0; i < 14; i++) {
        const day = format(subDays(now, 13 - i), "yyyy-MM-dd");
        dailyMap.set(day, { leads: 0, qualifications: 0 });
      }

      leadsDaily.data?.forEach(lead => {
        const day = format(new Date(lead.created_at), "yyyy-MM-dd");
        const current = dailyMap.get(day);
        if (current) {
          dailyMap.set(day, { ...current, leads: current.leads + 1 });
        }
      });

      qualsDaily.data?.forEach(qual => {
        const day = format(new Date(qual.created_at), "yyyy-MM-dd");
        const current = dailyMap.get(day);
        if (current) {
          dailyMap.set(day, { ...current, qualifications: current.qualifications + 1 });
        }
      });

      const chartDataArray: DailyData[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        leads: data.leads,
        qualifications: data.qualifications,
      }));

      setChartData(chartDataArray);
      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const leadsGrowth = stats.leadsLastWeek > 0 
    ? Math.round(((stats.leadsThisWeek - stats.leadsLastWeek) / stats.leadsLastWeek) * 100)
    : stats.leadsThisWeek > 0 ? 100 : 0;

  const qualificationRate = stats.qualifications > 0 
    ? Math.round((stats.qualificationsQualified / stats.qualifications) * 100)
    : 0;

  const conversionRate = stats.leads > 0 
    ? Math.round((stats.companyFormations / stats.leads) * 100)
    : 0;

  const pieData = [
    { name: "Qualificados", value: stats.qualificationsQualified, color: "hsl(var(--chart-1))" },
    { name: "Desqualificados", value: stats.qualifications - stats.qualificationsQualified, color: "hsl(var(--chart-2))" },
  ];

  const funnelData = [
    { stage: "Leads", value: stats.leads },
    { stage: "Qualificados", value: stats.qualificationsQualified },
    { stage: "Empresas", value: stats.companyFormations },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "lead": return <Users className="h-4 w-4 text-blue-500" />;
      case "qualification": return <ClipboardCheck className="h-4 w-4 text-green-500" />;
      case "formation": return <Building className="h-4 w-4 text-purple-500" />;
      case "subscription": return <CreditCard className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${diffDays}d atrás`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Badge variant="outline" className="text-xs">
          Atualizado agora
        </Badge>
      </div>
      
      {/* Primary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leads}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {leadsGrowth >= 0 ? (
                <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-1 text-red-500" />
              )}
              <span className={leadsGrowth >= 0 ? "text-green-500" : "text-red-500"}>
                {leadsGrowth >= 0 ? "+" : ""}{leadsGrowth}%
              </span>
              <span className="ml-1">vs semana passada</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualificações</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.qualifications}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500">{qualificationRate}%</span>
              <span className="ml-1">taxa de qualificação</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Formadas</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.companyFormations}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500">{conversionRate}%</span>
              <span className="ml-1">conversão total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documents}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>{stats.subscriptions} assinaturas</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Line Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Leads e Qualificações</CardTitle>
            <CardDescription>Últimos 14 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    name="Leads"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="qualifications" 
                    name="Qualificações"
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-2))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Taxa de Qualificação</CardTitle>
            <CardDescription>Distribuição de qualificações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              {stats.qualifications > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Funnel Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>De lead a empresa formada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis 
                    dataKey="stage" 
                    type="category" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>Últimas movimentações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[250px] overflow-y-auto">
              {recentActivities.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma atividade recente
                </p>
              ) : (
                recentActivities.map((activity) => (
                  <div key={`${activity.type}-${activity.id}`} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.subtitle}</p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      {formatTimeAgo(activity.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
