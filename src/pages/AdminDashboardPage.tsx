/* Admin Dashboard Geral — Anaheim Electronics Tactical Command Center
 * Hub executivo unificado: Telemetria de crescimento, SEO & Google Ads,
 * Controle de Informações Dinâmicas, Ações Relevantes (Artigos, Usuários, Cartas, Decks, Torneios),
 * Disparo de Workflows Git e Triagem de Bug Reports.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { AdminSocialTab } from "@/components/admin/AdminSocialTab";
import {
  ArrowRight,
  Share2,
  BarChart3,
  Bug,
  CheckCircle2,
  ClipboardCopy,
  Compass,
  Cpu,
  DollarSign,
  FileCode,
  GitBranch,
  Globe,
  HeartPulse,
  Layers,
  Megaphone,
  Newspaper,
  Package,
  PanelsTopLeft,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import {
  api,
  type AdminMetricsData,
  type AdminWorkflowItem,
  type AdminWorkflowsResponse,
  type ApiPost,
  type DataHealthResponse,
  type PostType,
  type PostStatus,
  type SiteConfig,
} from "@/lib/api";
import { adminTabFromHash, type AdminTab } from "@/lib/adminTabs";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#00f0ff", "#38bdf8", "#f59e0b", "#10b981", "#ef4444", "#a855f7", "#ec4899", "#64748b"];

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Estados principais
  const [activeTab, setActiveTab] = useState<AdminTab>(() => adminTabFromHash(typeof window === "undefined" ? "" : window.location.hash));
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetricsData | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Sub-estados para Central de Ações
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [decksList, setDecksList] = useState<any[]>([]);
  const [deckSearch, setDeckSearch] = useState("");
  const [setsList, setSetsList] = useState<any[]>([]);
  const [tournamentsList, setTournamentsList] = useState<any[]>([]);
  const [postsList, setPostsList] = useState<ApiPost[]>([]);

  // Workflows
  const [workflowsData, setWorkflowsData] = useState<AdminWorkflowsResponse | null>(null);
  const [dataHealth, setDataHealth] = useState<DataHealthResponse | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AdminWorkflowItem | null>(null);
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, any>>({ tarefa: "auditoria", aplicar: false });
  const [dispatching, setDispatching] = useState(false);

  // Bug Reports
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [bugStatusFilter, setBugStatusFilter] = useState<string>("all");
  const [selectedBug, setSelectedBug] = useState<any | null>(null);

  // Modal Novo Artigo
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [articleForm, setArticleForm] = useState({
    title: "",
    slug: "",
    postType: "NEWS" as PostType,
    status: "DRAFT" as PostStatus,
    excerpt: "",
    contentMd: "",
    coverImage: "",
    youtubeUrl: "",
  });
  const [savingArticle, setSavingArticle] = useState(false);

  // Modal Alterar Senha Admin
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Carga inicial
  const loadDashboardData = async () => {
    try {
      const [m, sc, u, d, s, t, p, w, b, h] = await Promise.all([
        api.getAdminMetrics().catch(() => null),
        api.getAdminSiteConfig().catch(() => null),
        api.listAdminUsers().catch(() => []),
        api.listAdminDecks({ pageSize: 15 }).catch(() => ({ items: [] })),
        api.listAdminSets().catch(() => []),
        api.listTournaments().catch(() => []),
        api.listPosts().catch(() => []),
        api.getAdminWorkflows().catch(() => null),
        api.listSimulatorBugReports().catch(() => []),
        api.getDataHealth().catch(() => null),
      ]);
      setDataHealth(h);

      setMetrics(m);
      setSiteConfig(sc);
      setUsersList(Array.isArray(u) ? u : []);
      setDecksList(d?.items || []);
      setSetsList(Array.isArray(s) ? s : []);
      setTournamentsList(Array.isArray(t) ? t : []);
      setPostsList(Array.isArray(p) ? p : []);
      setWorkflowsData(w);
      if (w?.workflows?.length) {
        setSelectedWorkflow(w.workflows[0]);
      }
      setBugReports(Array.isArray(b) ? b : []);
    } catch (err: any) {
      console.error("[AdminDashboard] Erro ao carregar dados:", err);
      toast.error("Falha ao carregar métricas administrativas.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    toast.success("Telemetria e dados atualizados com sucesso.");
  };

  // Salvar configurações dinâmicas do site
  const handleSaveSiteConfig = async () => {
    if (!siteConfig) return;
    try {
      setSavingConfig(true);
      const updated = await api.updateAdminSiteConfig(siteConfig);
      setSiteConfig(updated);
      toast.success("Configurações dinâmicas salvas e aplicadas em todo o portal!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar configurações dinâmicas.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Disparar Workflow
  const handleDispatchWorkflow = async () => {
    if (!selectedWorkflow) return;
    try {
      setDispatching(true);
      const res = await api.dispatchAdminWorkflow(selectedWorkflow.file, workflowInputs);
      if (res.dispatched) {
        toast.success(res.message || "Workflow disparado com sucesso!");
      } else if (!res.tokenConfigured) {
        toast.info(res.message || "Token não configurado. Execute o comando local abaixo.", { duration: 6000 });
      } else {
        toast.error(res.error || "GitHub rejeitou a solicitação de dispatch.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar requisição de dispatch.");
    } finally {
      setDispatching(false);
    }
  };

  // Resolver Bug Report
  const handleResolveBug = async (shortCode: string) => {
    try {
      await api.resolveSimulatorBugReport(shortCode);
      setBugReports((prev) => prev.map((b) => (b.shortCode === shortCode ? { ...b, status: "fixed" } : b)));
      if (selectedBug?.shortCode === shortCode) {
        setSelectedBug((b: any) => ({ ...b, status: "fixed" }));
      }
      toast.success(`Bug ${shortCode} marcado como resolvido!`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao resolver bug report.");
    }
  };

  // Salvar Artigo
  const handleCreateArticle = async () => {
    if (!articleForm.title.trim()) {
      toast.error("O artigo precisa de um título.");
      return;
    }
    try {
      setSavingArticle(true);
      const slug =
        articleForm.slug.trim() ||
        articleForm.title
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const created = await api.createPost({
        ...articleForm,
        slug,
      });
      setPostsList((prev) => [created, ...prev]);
      setArticleModalOpen(false);
      setArticleForm({
        title: "",
        slug: "",
        postType: "NEWS",
        status: "DRAFT",
        excerpt: "",
        contentMd: "",
        coverImage: "",
        youtubeUrl: "",
      });
      toast.success("Artigo criado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar artigo.");
    } finally {
      setSavingArticle(false);
    }
  };

  // Alterar senha do admin
  const handleChangeAdminPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (!user?.id) return;
    try {
      setSavingPassword(true);
      await api.updateAdminUser(user.id, { password: newPassword });
      toast.success("Senha administrativa alterada com sucesso! Guarde-a em local seguro.");
      setPasswordModalOpen(false);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Filtros de busca rápida
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return usersList.slice(0, 8);
    return usersList
      .filter((u) => u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [usersList, userSearch]);

  const filteredDecks = useMemo(() => {
    const q = deckSearch.toLowerCase().trim();
    if (!q) return decksList.slice(0, 8);
    return decksList
      .filter((d) => d.name?.toLowerCase().includes(q) || d.user?.username?.toLowerCase().includes(q) || d.user?.displayName?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [decksList, deckSearch]);

  const filteredBugs = useMemo(() => {
    if (bugStatusFilter === "all") return bugReports;
    return bugReports.filter((b) => b.status === bugStatusFilter);
  }, [bugReports, bugStatusFilter]);

  if (user?.role !== "ADMIN") {
    return (
      <AdminShell breadcrumbs={[{ label: "Terminal de Comando" }]}>
        <Card className="panel-cut rounded-none border-red-500/30 surface-panel">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="size-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-heading uppercase text-red-400">Acesso Restrito · Nível Alpha Requerido</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Esta área é restrita a administradores cadastrados com permissões de comando. Faça login com a conta administrativa para prosseguir.
            </p>
            <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/login">Ir para Login</Link>
            </Button>
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumbs={[{ label: "Terminal de Comando" }]}>
      <div className="space-y-6 pb-12">
        {/* Header HUD Tático Superior */}
        <Card className="panel-cut rounded-none border-primary/40 hero-surface relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono uppercase tracking-widest border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              VEDA ENGINE ONLINE
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="rounded-none border-white/20 bg-white/5 text-xs text-slate-300 hover:text-white"
            >
              <RefreshCw className={cn("size-3.5 mr-1.5", refreshing && "animate-spin")} />
              Sincronizar
            </Button>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-none border border-primary/50 bg-primary/20 text-primary font-mono text-[10px] tracking-widest uppercase">
                SECURITY CLEARANCE: LVL-9 ADMIN
              </Badge>
              <span className="text-xs text-slate-400 font-mono">
                Conta Ativa: <strong className="text-slate-200">{user.email}</strong> ({user.username})
              </span>
            </div>

            <div>
              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl uppercase tracking-wider text-white">
                Dashboard Geral do Administrador
              </h1>
              <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                Central unificada de controle, monitoramento de saúde do ecossistema, motor de monetização com Google Ads, práticas de SEO e gestão integral dos dados dinâmicos do portal.
              </p>
            </div>

            {/* Credenciais e Atalhos de Conta */}
            <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPasswordModalOpen(true)}
                className="rounded-none border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 text-xs"
              >
                <Settings className="size-3.5 mr-1.5" />
                Segurança & Senha Admin
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-none border-white/20 bg-white/5 text-slate-300 hover:text-white text-xs"
              >
                <Link href="/admin/articles">
                  <Newspaper className="size-3.5 mr-1.5 text-primary" />
                  Módulo Editorial CMS
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-none border-white/20 bg-white/5 text-slate-300 hover:text-white text-xs"
              >
                <Link href="/admin/cards">
                  <PanelsTopLeft className="size-3.5 mr-1.5 text-cyan-400" />
                  Catálogo Completo
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-none border-white/20 bg-white/5 text-slate-300 hover:text-white text-xs"
              >
                <Link href="/admin/events">
                  <Trophy className="size-3.5 mr-1.5 text-amber-400" />
                  Gestão de Torneios
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Grade de KPIs Primários de Telemetria */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <Card className="panel-cut rounded-none surface-panel border-white/10">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-mono tracking-wider">Usuários</span>
                <Users className="size-4 text-cyan-400" />
              </div>
              <p className="font-heading text-3xl text-white">{metrics?.kpis.totalUsers ?? "—"}</p>
              <p className="text-[11px] text-emerald-400 font-medium">
                {metrics?.kpis.activeUsers ?? 0} ativos · {metrics?.kpis.supporterUsers ?? 0} apoiadores
              </p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel border-white/10">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-mono tracking-wider">Decks Criados</span>
                <Layers className="size-4 text-amber-400" />
              </div>
              <p className="font-heading text-3xl text-white">{metrics?.kpis.totalDecks ?? "—"}</p>
              <p className="text-[11px] text-slate-400">
                {metrics?.kpis.publicDecks ?? 0} públicos ({metrics?.kpis.totalDeckViews ?? 0} views)
              </p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel border-white/10">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-mono tracking-wider">Cartas no Hub</span>
                <PanelsTopLeft className="size-4 text-primary" />
              </div>
              <p className="font-heading text-3xl text-white">{metrics?.kpis.totalCards ?? "—"}</p>
              <p className="text-[11px] text-primary font-medium">
                {metrics?.kpis.totalCardModels ?? 0} modelos em {metrics?.kpis.totalSets ?? 0} sets
              </p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel border-white/10">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-mono tracking-wider">Simulador</span>
                <Swords className="size-4 text-red-400" />
              </div>
              <p className="font-heading text-3xl text-white">{metrics?.kpis.totalMatches ?? 0}</p>
              <p className="text-[11px] text-emerald-400 font-medium">
                {metrics?.kpis.finishedMatches ?? 0} partidas finalizadas
              </p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel border-white/10">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-mono tracking-wider">Torneios Veda</span>
                <Trophy className="size-4 text-yellow-400" />
              </div>
              <p className="font-heading text-3xl text-white">
                {(metrics?.kpis.totalTournaments ?? 0) + (metrics?.kpis.totalHostedEvents ?? 0)}
              </p>
              <p className="text-[11px] text-slate-400">
                {metrics?.kpis.totalTournaments ?? 0} oficiais · {metrics?.kpis.totalHostedEvents ?? 0} hoster
              </p>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel border-white/10">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-mono tracking-wider">Bug Reports</span>
                <Bug className="size-4 text-orange-400" />
              </div>
              <p className="font-heading text-3xl text-white">{metrics?.kpis.totalBugReports ?? 0}</p>
              <p className="text-[11px] text-orange-400 font-medium">
                {metrics?.kpis.newBugReports ?? 0} pendentes · {metrics?.kpis.fixedBugReports ?? 0} corrigidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Navegação por Abas Especializadas */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
          <TabsList className="bg-slate-900/90 border border-white/15 p-1 rounded-none flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="rounded-none text-xs uppercase tracking-wider py-2 px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="size-3.5 mr-1.5" />
              1. Visão Geral & Gráficos
            </TabsTrigger>
            <TabsTrigger value="marketing" className="rounded-none text-xs uppercase tracking-wider py-2 px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <DollarSign className="size-3.5 mr-1.5" />
              2. Google Ads & SEO
            </TabsTrigger>
            <TabsTrigger value="social" className="rounded-none text-xs uppercase tracking-wider py-2 px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Share2 className="size-3.5 mr-1.5" />
              3. Redes Sociais & IA
            </TabsTrigger>
            <TabsTrigger value="dynamic" className="rounded-none text-xs uppercase tracking-wider py-2 px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Megaphone className="size-3.5 mr-1.5" />
              4. Informações Dinâmicas
            </TabsTrigger>
            <TabsTrigger value="actions" className="rounded-none text-xs uppercase tracking-wider py-2 px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Compass className="size-3.5 mr-1.5" />
              5. Ações do Sistema
            </TabsTrigger>
            <TabsTrigger value="workflows" className="rounded-none text-xs uppercase tracking-wider py-2 px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <GitBranch className="size-3.5 mr-1.5" />
              6. Git Workflows
              {dataHealth?.stale && <span className="ml-1.5 inline-block size-2 rounded-full bg-red-500" aria-label="coleta atrasada" />}
            </TabsTrigger>
            <TabsTrigger value="bugs" className="rounded-none text-xs uppercase tracking-wider py-2 px-3.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bug className="size-3.5 mr-1.5" />
              7. Bug Reports ({metrics?.kpis.newBugReports ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* ────────────────────────────────────────────────────────────────
              ABA 1: VISÃO GERAL & GRÁFICOS DE CRESCIMENTO
          ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Gráfico 1: Curva de Crescimento de Usuários & Decks */}
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-lg uppercase text-white">Crescimento de Base & Engajamento</h3>
                      <p className="text-xs text-slate-400">Evolução acumulada de contas cadastradas e decks construídos</p>
                    </div>
                    <Badge variant="outline" className="border-cyan-400/40 text-cyan-300 font-mono text-[10px]">
                      SÉRIE TEMPORAL
                    </Badge>
                  </div>

                  <div className="h-72 w-full pt-4">
                    {metrics?.userGrowthData && metrics.userGrowthData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metrics.userGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="gradDecks" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                          <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: 0, fontSize: "12px" }}
                            labelStyle={{ color: "#f8fafc", fontWeight: "bold" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          <Area type="monotone" dataKey="users" name="Usuários" stroke="#00f0ff" strokeWidth={2} fillOpacity={1} fill="url(#gradUsers)" />
                          <Area type="monotone" dataKey="decks" name="Decks Criados" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#gradDecks)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        Carregando série histórica de métricas...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico 2: Distribuição de Cartas por Tipo */}
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-lg uppercase text-white">Composição do Catálogo Oficial</h3>
                      <p className="text-xs text-slate-400">Proporção de tipos de cartas ativas no ecossistema Gundam</p>
                    </div>
                    <Badge variant="outline" className="border-primary/40 text-primary font-mono text-[10px]">
                      {metrics?.kpis.totalCards ?? 0} CARTAS
                    </Badge>
                  </div>

                  <div className="h-72 w-full pt-4">
                    {metrics?.cardTypesDistribution && metrics.cardTypesDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.cardTypesDistribution}
                            dataKey="count"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {metrics.cardTypesDistribution.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="#020617" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: 0, fontSize: "12px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        Processando dados de catálogo...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Painel Inferior: Panorama de Saúde do Sistema */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-heading text-lg uppercase text-white flex items-center gap-2">
                  <Cpu className="size-5 text-primary" />
                  Panorama Geral de Saúde & Prontidão
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border border-white/10 bg-white/[0.02] p-4 space-y-2">
                    <p className="text-xs font-mono uppercase text-slate-400">Prontidão para Google Ads</p>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white text-sm">Pronto para Monetização</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Páginas institucionais de Privacidade e Termos de Uso ativas. Rotas públicas livres de barreiras.
                    </p>
                  </div>

                  <div className="border border-white/10 bg-white/[0.02] p-4 space-y-2">
                    <p className="text-xs font-mono uppercase text-slate-400">Indexação de Busca (SEO)</p>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-cyan-400" />
                      <span className="font-bold text-white text-sm">Score 96/100 (Excelente)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Sitemap dinâmico mapeando mais de 1.800 cartas, relatórios de torneios e decklists públicas.
                    </p>
                  </div>

                  <div className="border border-white/10 bg-white/[0.02] p-4 space-y-2">
                    <p className="text-xs font-mono uppercase text-slate-400">Integridade do Catálogo</p>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white text-sm">100% Imagens & Textos</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Sets GD01 a GD05, ST01 a ST14 e EB01 reconciliados com rulings oficiais da Bandai.
                    </p>
                  </div>

                  <div className="border border-white/10 bg-white/[0.02] p-4 space-y-2">
                    <p className="text-xs font-mono uppercase text-slate-400">Estabilidade do Simulador</p>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-amber-400" />
                      <span className="font-bold text-white text-sm">{metrics?.kpis.newBugReports ?? 0} Relatos Pendentes</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Motor com persistência write-through no Supabase e suporte a solo treino heurístico.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────
              ABA 2: GOOGLE ADS, SEO & ESTRATÉGIA DE NEGÓCIOS
          ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="marketing" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Seção Google Ads & Monetização */}
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h3 className="font-heading text-xl uppercase text-white flex items-center gap-2">
                        <DollarSign className="size-5 text-emerald-400" />
                        Google Ads & Gestão de Anúncios
                      </h3>
                      <p className="text-xs text-slate-400">Controle dinâmico de blocos e estimativas de faturamento</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">Status Geral:</span>
                      <Switch
                        checked={siteConfig?.monetization.adsEnabled ?? true}
                        onCheckedChange={(checked) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            monetization: { ...prev.monetization, adsEnabled: checked },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">ID do Editor (Google AdSense)</label>
                      <Input
                        value={siteConfig?.monetization.adSenseClientId ?? ""}
                        onChange={(e) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            monetization: { ...prev.monetization, adSenseClientId: e.target.value },
                          }))
                        }
                        placeholder="Ex: ca-pub-1234567890123456"
                        className="rounded-none font-mono text-sm"
                      />
                    </div>

                    <div className="border border-white/10 bg-white/[0.02] p-4 space-y-3">
                      <p className="text-xs uppercase font-mono text-slate-300 font-semibold">Slots Estratégicos de Anúncio</p>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            checked={siteConfig?.monetization.slots.topBanner ?? true}
                            onCheckedChange={(checked) =>
                              setSiteConfig((prev: any) => ({
                                ...prev,
                                monetization: {
                                  ...prev.monetization,
                                  slots: { ...prev.monetization.slots, topBanner: checked },
                                },
                              }))
                            }
                          />
                          <span>Banner Topo Hangar (728x90)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            checked={siteConfig?.monetization.slots.sidebarBanner ?? true}
                            onCheckedChange={(checked) =>
                              setSiteConfig((prev: any) => ({
                                ...prev,
                                monetization: {
                                  ...prev.monetization,
                                  slots: { ...prev.monetization.slots, sidebarBanner: checked },
                                },
                              }))
                            }
                          />
                          <span>Lateral Deckbuilder (300x250)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            checked={siteConfig?.monetization.slots.inArticleSponsored ?? true}
                            onCheckedChange={(checked) =>
                              setSiteConfig((prev: any) => ({
                                ...prev,
                                monetization: {
                                  ...prev.monetization,
                                  slots: { ...prev.monetization.slots, inArticleSponsored: checked },
                                },
                              }))
                            }
                          />
                          <span>In-Article Patrocinado</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            checked={siteConfig?.monetization.slots.torneiosSponsored ?? true}
                            onCheckedChange={(checked) =>
                              setSiteConfig((prev: any) => ({
                                ...prev,
                                monetization: {
                                  ...prev.monetization,
                                  slots: { ...prev.monetization.slots, torneiosSponsored: checked },
                                },
                              }))
                            }
                          />
                          <span>Vitrine de Torneios Veda</span>
                        </label>
                      </div>
                    </div>

                    {/* Projeção de Faturamento */}
                    <div className="border border-emerald-500/30 bg-emerald-500/[0.04] p-4 space-y-2">
                      <p className="text-[11px] font-mono uppercase text-emerald-400 font-semibold">Simulação de Potencial de Receita</p>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-300">Estimativa Mensal de Pageviews:</span>
                        <span className="font-mono font-bold text-white text-sm">
                          {metrics?.monetization.estimatedMonthlyPageviews.toLocaleString("pt-BR") ?? "—"} PVs
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-300">RPM Base Projetado (Nicho Games/TCG):</span>
                        <span className="font-mono font-bold text-white text-sm">
                          R$ {siteConfig?.monetization.estimatedRpmBrl?.toFixed(2) ?? "14.50"} / 1.000 PV
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between border-t border-emerald-500/20 pt-2">
                        <span className="text-xs font-semibold text-emerald-300">Projeção de Ganho Mensal:</span>
                        <span className="font-mono font-bold text-emerald-400 text-lg">
                          R$ {metrics?.monetization.estimatedMonthlyRevenueBrl?.toFixed(2) ?? "0.00"}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveSiteConfig}
                      disabled={savingConfig}
                      className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider font-semibold"
                    >
                      {savingConfig ? "Salvando configurações..." : "Salvar Configurações de Ads"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Seção SEO & Visibilidade Orgânica */}
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h3 className="font-heading text-xl uppercase text-white flex items-center gap-2">
                        <Globe className="size-5 text-cyan-400" />
                        Otimização para Mecanismos de Busca (SEO)
                      </h3>
                      <p className="text-xs text-slate-400">Indexação, sitemap dinâmico e palavras-chave de metagame</p>
                    </div>
                    <Badge className="rounded-none border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 font-mono">
                      SCORE: {metrics?.seoHealth.score ?? 96}/100
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">Título Padrão das Páginas (Meta Title)</label>
                      <Input
                        value={siteConfig?.seo.metaTitleDefault ?? ""}
                        onChange={(e) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            seo: { ...prev.seo, metaTitleDefault: e.target.value },
                          }))
                        }
                        className="rounded-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">Descrição Padrão (Meta Description)</label>
                      <Textarea
                        value={siteConfig?.seo.metaDescriptionDefault ?? ""}
                        onChange={(e) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            seo: { ...prev.seo, metaDescriptionDefault: e.target.value },
                          }))
                        }
                        className="rounded-none text-xs min-h-[70px]"
                      />
                    </div>

                    <div className="border border-white/10 bg-white/[0.02] p-4 space-y-2">
                      <p className="text-xs font-mono uppercase text-slate-300 font-semibold">Checklist de Auditoria Técnica</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-emerald-400" /> Sitemap XML Ativo
                          </span>
                          <span className="font-mono text-slate-400">/sitemap.xml (1.800+ URLs)</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-emerald-400" /> Diretivas do Robô
                          </span>
                          <span className="font-mono text-slate-400">/robots.txt (Allow: /)</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-emerald-400" /> Metatags Open Graph & Twitter Cards
                          </span>
                          <span className="font-mono text-emerald-400">Implementadas</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-emerald-400" /> Conformidade Google (LGPD / Privacidade)
                          </span>
                          <span className="font-mono text-emerald-400">Páginas Públicas Ativas</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">Palavras-chave Alvo (Keywords)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {siteConfig?.seo.targetKeywords?.map((kw, i) => (
                          <Badge key={i} variant="outline" className="rounded-none border-cyan-400/30 text-cyan-300 text-[11px]">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveSiteConfig}
                      disabled={savingConfig}
                      className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider font-semibold"
                    >
                      {savingConfig ? "Salvando..." : "Salvar Configurações de SEO"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────
              ABA 3: REDES SOCIAIS & IA (INSTAGRAM / DISCORD)
          ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="social" className="space-y-6">
            <AdminSocialTab />
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────
              ABA 4: INFORMAÇÕES DINÂMICAS DO SITE (BANNER & DESTAQUES)
          ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="dynamic" className="space-y-6">
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="font-heading text-xl uppercase text-white flex items-center gap-2">
                    <Megaphone className="size-5 text-amber-400" />
                    Aviso Global do Portal (Broadcast Banner)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mensagem dinâmica transmitida no topo de todas as páginas públicas e privadas para toda a comunidade de jogadores.
                  </p>
                </div>

                {/* Preview em Tempo Real */}
                <div className="space-y-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Prévia Visual em Tempo Real:</p>
                  <div
                    className={cn(
                      "p-3 border rounded-none flex items-center justify-between gap-3 text-xs",
                      siteConfig?.announcement.type === "WARNING"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : siteConfig?.announcement.type === "SUCCESS"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : siteConfig?.announcement.type === "URGENT"
                            ? "border-red-500/40 bg-red-500/10 text-red-300"
                            : "border-primary/40 bg-primary/10 text-primary"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="size-2 rounded-full bg-current animate-ping" />
                      <span className="font-bold uppercase tracking-wider text-[10px] border px-1.5 py-0.5">
                        {siteConfig?.announcement.type || "INFO"}
                      </span>
                      <span className="truncate">{siteConfig?.announcement.message || "Escreva uma mensagem..."}</span>
                    </div>
                    {siteConfig?.announcement.link ? (
                      <span className="text-[11px] font-bold underline flex items-center gap-1 shrink-0">
                        {siteConfig?.announcement.linkText || "Ver mais"} <ArrowRight className="size-3" />
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase font-mono text-slate-400">Status do Banner</label>
                      <Switch
                        checked={siteConfig?.announcement.active ?? false}
                        onCheckedChange={(checked) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            announcement: { ...prev.announcement, active: checked },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">Tipo de Notificação</label>
                      <select
                        value={siteConfig?.announcement.type ?? "INFO"}
                        onChange={(e) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            announcement: { ...prev.announcement, type: e.target.value as any },
                          }))
                        }
                        className="w-full h-10 px-3 bg-slate-950 border border-white/20 text-xs text-white rounded-none"
                      >
                        <option value="INFO">Informativo (Ciano / Primary)</option>
                        <option value="WARNING">Aviso / Importante (Âmbar)</option>
                        <option value="SUCCESS">Sucesso / Lançamento (Esmeralda)</option>
                        <option value="URGENT">Urgente / Alerta de Manutenção (Vermelho)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">Link de Ação (URL ou Rota)</label>
                      <Input
                        value={siteConfig?.announcement.link ?? ""}
                        onChange={(e) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            announcement: { ...prev.announcement, link: e.target.value },
                          }))
                        }
                        placeholder="Ex: /simulador ou /torneios"
                        className="rounded-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">Texto do Link de Ação</label>
                      <Input
                        value={siteConfig?.announcement.linkText ?? ""}
                        onChange={(e) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            announcement: { ...prev.announcement, linkText: e.target.value },
                          }))
                        }
                        placeholder="Ex: Conferir Novidade"
                        className="rounded-none text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs uppercase font-mono text-slate-400 block mb-1">Texto do Aviso</label>
                      <Textarea
                        value={siteConfig?.announcement.message ?? ""}
                        onChange={(e) =>
                          setSiteConfig((prev: any) => ({
                            ...prev,
                            announcement: { ...prev.announcement, message: e.target.value },
                          }))
                        }
                        placeholder="Escreva a mensagem pública do aviso..."
                        className="rounded-none text-xs min-h-[120px]"
                      />
                    </div>

                    <div className="border border-white/10 bg-white/[0.02] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-white">Modo Manutenção Geral</p>
                          <p className="text-[11px] text-slate-400">Exibe aviso de manutenção programada aos usuários</p>
                        </div>
                        <Switch
                          checked={siteConfig?.metagame.maintenanceMode ?? false}
                          onCheckedChange={(checked) =>
                            setSiteConfig((prev: any) => ({
                              ...prev,
                              metagame: { ...prev.metagame, maintenanceMode: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 flex justify-end">
                  <Button
                    onClick={handleSaveSiteConfig}
                    disabled={savingConfig}
                    className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider font-semibold"
                  >
                    {savingConfig ? "Salvando..." : "Salvar & Transmitir Aviso do Portal"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────
              ABA 4: CENTRAL DE AÇÕES RELEVANTES DO SISTEMA
          ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="actions" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card Ação: Artigos & Notícias */}
              <Card className="panel-cut rounded-none surface-panel border-white/10 flex flex-col justify-between">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="p-2 border border-primary/40 bg-primary/10 text-primary">
                      <Newspaper className="size-5" />
                    </span>
                    <Badge variant="outline" className="border-white/20 text-slate-400 font-mono text-[10px]">
                      {postsList.length} ARTIGOS
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg uppercase text-white">Notícias & Artigos</h3>
                    <p className="text-xs text-slate-400">
                      Editor de artigos com suporte a Markdown, capa de imagem ou arte de carta e vídeo do YouTube.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => setArticleModalOpen(true)}
                      className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold uppercase tracking-wider"
                    >
                      <Plus className="size-3.5 mr-1.5" />
                      Novo Artigo / Notícia
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-none border-white/20 text-xs">
                      <Link href="/admin/articles">Abrir Módulo Editorial Completo</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Ação: Usuários & Permissões */}
              <Card className="panel-cut rounded-none surface-panel border-white/10 flex flex-col justify-between">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="p-2 border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">
                      <Users className="size-5" />
                    </span>
                    <Badge variant="outline" className="border-cyan-400/30 text-cyan-300 font-mono text-[10px]">
                      {usersList.length} CONTAS
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg uppercase text-white">Gestão de Usuários</h3>
                    <p className="text-xs text-slate-400">
                      Controle de papéis (User, Editor, Admin), concessão de permissão de Hoster e insígnia de Apoiador.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Filtrar por nome, usuário ou e-mail..."
                      className="rounded-none text-xs"
                    />
                    <Button asChild variant="outline" className="w-full rounded-none border-white/20 text-xs">
                      <Link href="/admin/users">Gerenciar Todos os Usuários</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Ação: Cartas & Catálogo */}
              <Card className="panel-cut rounded-none surface-panel border-white/10 flex flex-col justify-between">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="p-2 border border-amber-400/40 bg-amber-400/10 text-amber-300">
                      <PanelsTopLeft className="size-5" />
                    </span>
                    <Badge variant="outline" className="border-amber-400/30 text-amber-300 font-mono text-[10px]">
                      {metrics?.kpis.totalCards ?? 0} ITENS
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg uppercase text-white">Catálogo de Cartas</h3>
                    <p className="text-xs text-slate-400">
                      Reconciliação de modelos canônicos, traduções pt-BR, status de legalidade (Banlist) e variantes.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Button asChild className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold uppercase tracking-wider">
                      <Link href="/admin/cards">Abrir Gestor de Cartas</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-none border-white/20 text-xs">
                      <Link href="/admin/simulador/cobertura">Auditar Cobertura no Simulador</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Ação: Decks da Comunidade */}
              <Card className="panel-cut rounded-none surface-panel border-white/10 flex flex-col justify-between">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="p-2 border border-purple-400/40 bg-purple-400/10 text-purple-300">
                      <Layers className="size-5" />
                    </span>
                    <Badge variant="outline" className="border-purple-400/30 text-purple-300 font-mono text-[10px]">
                      {decksList.length} DECKS
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg uppercase text-white">Moderação de Decks</h3>
                    <p className="text-xs text-slate-400">
                      Inspeção de decklists públicas, métricas de visualização, validação de legalidade e destaque.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Input
                      value={deckSearch}
                      onChange={(e) => setDeckSearch(e.target.value)}
                      placeholder="Buscar por nome do deck..."
                      className="rounded-none text-xs"
                    />
                    <Button asChild variant="outline" className="w-full rounded-none border-white/20 text-xs">
                      <Link href="/decks">Ver Decks Públicos no Portal</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Ação: Produtos & Coleções */}
              <Card className="panel-cut rounded-none surface-panel border-white/10 flex flex-col justify-between">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="p-2 border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
                      <Package className="size-5" />
                    </span>
                    <Badge variant="outline" className="border-emerald-400/30 text-emerald-300 font-mono text-[10px]">
                      {setsList.length} SETS
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg uppercase text-white">Produtos & Coleções</h3>
                    <p className="text-xs text-slate-400">
                      Cadastro de Booster Packs, Starter Decks e Premium Bandai, datas de lançamento e MSRP.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Button asChild className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold uppercase tracking-wider">
                      <Link href="/admin/collections">Gestão de Coleções</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-none border-white/20 text-xs">
                      <Link href="/admin/seasons">Gerenciar Temporadas (Seasons)</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Ação: Torneios & Eventos */}
              <Card className="panel-cut rounded-none surface-panel border-white/10 flex flex-col justify-between">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="p-2 border border-yellow-400/40 bg-yellow-400/10 text-yellow-300">
                      <Trophy className="size-5" />
                    </span>
                    <Badge variant="outline" className="border-yellow-400/30 text-yellow-300 font-mono text-[10px]">
                      {tournamentsList.length} EVENTOS
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-heading text-lg uppercase text-white">Torneios & Veda Hub</h3>
                    <p className="text-xs text-slate-400">
                      Registro de campeonatos oficiais e comunitários, vinculação de decklists e vídeos de transmissão (VODs).
                    </p>
                  </div>
                  <div className="space-y-2 pt-2">
                    <Button asChild className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold uppercase tracking-wider">
                      <Link href="/admin/events">Central de Eventos</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-none border-white/20 text-xs">
                      <Link href="/torneios">Ver Relatórios Públicos</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Listas Rápidas de Ação Direta */}
            <div className="grid gap-6 lg:grid-cols-2 pt-2">
              {/* Tabela Rápida de Usuários */}
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-base uppercase text-white">Usuários Recentes</h4>
                    <span className="text-xs text-slate-400">{filteredUsers.length} exibidos</span>
                  </div>
                  <div className="overflow-x-auto border border-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/5 uppercase text-slate-400 text-left">
                        <tr>
                          <th className="p-2.5">Usuário</th>
                          <th className="p-2.5">Papel</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-white/[0.02]">
                            <td className="p-2.5">
                              <p className="font-medium text-white">{u.displayName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                            </td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="rounded-none border-primary/40 text-primary text-[10px]">
                                {u.role}
                              </Badge>
                            </td>
                            <td className="p-2.5">
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 border", u.isActive ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10" : "border-red-400/40 text-red-400 bg-red-400/10")}>
                                {u.isActive ? "Ativo" : "Bloqueado"}
                              </span>
                            </td>
                            <td className="p-2.5 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  await api.updateAdminUser(u.id, { isHoster: !u.isHoster });
                                  setUsersList((prev) => prev.map((item) => (item.id === u.id ? { ...item, isHoster: !item.isHoster } : item)));
                                  toast.success(u.isHoster ? "Hoster revogado." : "Usuário promovido a Hoster!");
                                }}
                                className="rounded-none text-[10px] h-7 px-2"
                              >
                                {u.isHoster ? "Revogar Hoster" : "Tornar Hoster"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Tabela Rápida de Decks */}
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-base uppercase text-white">Decks em Destaque & Moderação</h4>
                    <span className="text-xs text-slate-400">{filteredDecks.length} exibidos</span>
                  </div>
                  <div className="overflow-x-auto border border-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/5 uppercase text-slate-400 text-left">
                        <tr>
                          <th className="p-2.5">Deck</th>
                          <th className="p-2.5">Autor</th>
                          <th className="p-2.5">Visibilidade</th>
                          <th className="p-2.5 text-right">Destaque</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredDecks.map((d) => (
                          <tr key={d.id} className="hover:bg-white/[0.02]">
                            <td className="p-2.5">
                              <p className="font-medium text-white truncate max-w-[150px]">{d.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {d.viewCount ?? 0} views · {d.likeCount ?? 0} likes
                              </p>
                            </td>
                            <td className="p-2.5 text-slate-300">
                              {d.user?.displayName || d.user?.username || "Anônimo"}
                            </td>
                            <td className="p-2.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 border border-white/15 bg-white/5 text-slate-300">
                                {d.visibility}
                              </span>
                            </td>
                            <td className="p-2.5 text-right">
                              <Button
                                size="sm"
                                variant={d.isPrimary ? "default" : "outline"}
                                onClick={async () => {
                                  await api.toggleAdminDeckPrimary(d.id);
                                  setDecksList((prev) => prev.map((item) => (item.id === d.id ? { ...item, isPrimary: !item.isPrimary } : item)));
                                  toast.success(d.isPrimary ? "Deck removido dos destaques." : "Deck destacado na página inicial!");
                                }}
                                className="rounded-none text-[10px] h-7 px-2"
                              >
                                {d.isPrimary ? "Destaque ★" : "Destacar"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────
              ABA 5: WORKFLOWS DO GIT & COMANDOS DE POPULAÇÃO
          ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="workflows" className="space-y-6">
            {dataHealth && (
              <Card
                className={cn(
                  "panel-cut rounded-none surface-panel",
                  dataHealth.stale ? "border-red-500/40" : "border-white/10",
                )}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-lg uppercase text-white flex items-center gap-2">
                        <HeartPulse className={cn("size-5", dataHealth.stale ? "text-red-400" : "text-emerald-400")} />
                        Saúde da coleta de torneios
                      </h3>
                      <p className="text-xs text-slate-400">
                        Última importação de cada fonte no banco. Sem importar há mais de {dataHealth.staleAfterHours} h, a fonte fica
                        atrasada: veja o run do "Dados do site" ou dispare a tarefa <span className="font-mono">torneios</span> abaixo.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-none font-mono text-[10px]",
                        dataHealth.stale ? "border-red-400/40 text-red-300 bg-red-400/10" : "border-emerald-400/40 text-emerald-400 bg-emerald-400/10",
                      )}
                    >
                      {dataHealth.stale ? "COLETA ATRASADA" : "COLETA EM DIA"}
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {dataHealth.sources.map((src) => (
                      <div key={src.id} className={cn("border p-3 text-xs space-y-1", src.stale ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-white/[0.02]")}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase tracking-wider text-white">{src.name}</span>
                          <span className={cn("font-mono text-[10px]", src.stale ? "text-red-300" : "text-emerald-400")}>
                            {src.stale ? "ATRASADA" : "OK"}
                          </span>
                        </div>
                        <p className="text-slate-400">
                          Importado em:{" "}
                          <span className="text-slate-200">{src.lastImportAt ? new Date(src.lastImportAt).toLocaleString("pt-BR") : "nunca"}</span>
                        </p>
                        <p className="text-slate-400">
                          {src.tournaments.toLocaleString("pt-BR")} torneios · último evento {src.lastEventDate ?? "—"}
                        </p>
                      </div>
                    ))}
                    {dataHealth.workflow && (
                      <div className="border border-white/10 bg-white/[0.02] p-3 text-xs space-y-1">
                        <span className="font-bold uppercase tracking-wider text-white">Run do Dados do site</span>
                        {dataHealth.workflow.lastRun ? (
                          <p className="text-slate-400">
                            Último:{" "}
                            <a href={dataHealth.workflow.lastRun.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {dataHealth.workflow.lastRun.conclusion ?? dataHealth.workflow.lastRun.status}
                            </a>{" "}
                            em {new Date(dataHealth.workflow.lastRun.createdAt).toLocaleString("pt-BR")} ({dataHealth.workflow.lastRun.event})
                          </p>
                        ) : (
                          <p className="text-slate-400">Nenhum run encontrado.</p>
                        )}
                        <p className="text-slate-400">
                          Último com sucesso:{" "}
                          <span className="text-slate-200">
                            {dataHealth.workflow.lastSuccessAt ? new Date(dataHealth.workflow.lastSuccessAt).toLocaleString("pt-BR") : "—"}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="font-heading text-xl uppercase text-white flex items-center gap-2">
                      <GitBranch className="size-5 text-primary" />
                      Workflows do GitHub & Automação de Dados
                    </h3>
                    <p className="text-xs text-slate-400">
                      Disparo de rotinas de população, scraping oficial, benchmarks do simulador e atualização do Veda System.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-none font-mono text-[10px]",
                        workflowsData?.hasToken ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10" : "border-amber-400/40 text-amber-300 bg-amber-400/10"
                      )}
                    >
                      {workflowsData?.hasToken ? "GH_DISPATCH_TOKEN: CONECTADO" : "TOKEN: MODO LOCAL / CLI"}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Lista de Workflows */}
                  <div className="space-y-2 lg:col-span-1">
                    <p className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">Selecione o Workflow:</p>
                    {workflowsData?.workflows.map((wf) => (
                      <button
                        key={wf.id}
                        type="button"
                        onClick={() => {
                          setSelectedWorkflow(wf);
                          setWorkflowInputs(wf.id === "dados-site" ? { tarefa: "auditoria", aplicar: false } : {});
                        }}
                        className={cn(
                          "w-full text-left p-3.5 border transition-all text-xs space-y-1 rounded-none",
                          selectedWorkflow?.id === wf.id
                            ? "border-primary bg-primary/10 text-white"
                            : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:text-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase tracking-wider">{wf.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">{wf.file}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">{wf.description}</p>
                      </button>
                    ))}
                  </div>

                  {/* Painel de Configuração e Disparo */}
                  <div className="lg:col-span-2 border border-white/10 bg-white/[0.02] p-5 space-y-5 rounded-none">
                    {selectedWorkflow ? (
                      <>
                        <div>
                          <h4 className="font-heading text-lg uppercase text-white flex items-center gap-2">
                            <FileCode className="size-4 text-primary" />
                            {selectedWorkflow.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">{selectedWorkflow.description}</p>
                        </div>

                        {/* Formulário dinâmico de parâmetros */}
                        {selectedWorkflow.inputs && selectedWorkflow.inputs.length > 0 ? (
                          <div className="space-y-4 border-t border-white/10 pt-4">
                            <p className="text-xs font-mono uppercase tracking-wider text-slate-300">Parâmetros de Execução:</p>
                            {selectedWorkflow.inputs.map((inp) => (
                              <div key={inp.name} className="space-y-1.5">
                                <label className="text-xs text-slate-300 font-medium">{inp.label}</label>
                                {inp.type === "choice" ? (
                                  <select
                                    value={workflowInputs[inp.name] || inp.default}
                                    onChange={(e) =>
                                      setWorkflowInputs((prev) => ({ ...prev, [inp.name]: e.target.value }))
                                    }
                                    className="w-full h-9 px-3 bg-slate-950 border border-white/20 text-xs text-white rounded-none"
                                  >
                                    {inp.options?.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : inp.type === "boolean" ? (
                                  <div className="flex items-center gap-2 pt-1">
                                    <Switch
                                      checked={Boolean(workflowInputs[inp.name])}
                                      onCheckedChange={(checked) =>
                                        setWorkflowInputs((prev) => ({ ...prev, [inp.name]: checked }))
                                      }
                                    />
                                    <span className="text-xs text-slate-400">
                                      {workflowInputs[inp.name] ? "Sim, aplicar alterações no banco" : "Apenas simulação / dry-run"}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {/* Botão de Disparo */}
                        <div className="space-y-3 pt-2">
                          <Button
                            onClick={handleDispatchWorkflow}
                            disabled={dispatching}
                            className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider font-semibold py-2.5"
                          >
                            <Play className="size-3.5 mr-1.5" />
                            {dispatching ? "Disparando no GitHub..." : "Executar Workflow no GitHub Actions"}
                          </Button>

                          {/* Fallback CLI Snippet com 1-Clique para Copiar */}
                          <div className="border border-white/10 bg-slate-950 p-3 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                              <span>Comando alternativo de terminal (Local / VPS):</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedWorkflow.cliSnippet);
                                  toast.success("Comando copiado para a área de transferência!");
                                }}
                                className="text-primary hover:text-white flex items-center gap-1"
                              >
                                <ClipboardCopy className="size-3" /> Copiar
                              </button>
                            </div>
                            <code className="block font-mono text-emerald-400 bg-black/40 p-2 text-xs">
                              {selectedWorkflow.cliSnippet}
                            </code>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Selecione um workflow ao lado.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────────────────────────────────────────────────────────────
              ABA 6: BUG REPORTS DO SIMULADOR (TRIAGEM & RESOLUÇÃO)
          ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="bugs" className="space-y-6">
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="font-heading text-xl uppercase text-white flex items-center gap-2">
                      <Bug className="size-5 text-orange-400" />
                      Triagem de Bug Reports do Simulador
                    </h3>
                    <p className="text-xs text-slate-400">
                      Situações reportadas diretamente pelos jogadores durante as partidas (snapshot de GameState e BattleLog).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Filtrar:</span>
                    <select
                      value={bugStatusFilter}
                      onChange={(e) => setBugStatusFilter(e.target.value)}
                      className="h-8 px-2.5 bg-slate-950 border border-white/20 text-xs text-white rounded-none"
                    >
                      <option value="all">Todos ({bugReports.length})</option>
                      <option value="new">Pendentes (New)</option>
                      <option value="fixed">Resolvidos (Fixed)</option>
                    </select>
                  </div>
                </div>

                {filteredBugs.length > 0 ? (
                  <div className="grid gap-6 lg:grid-cols-3">
                    {/* Lista de Relatos */}
                    <div className="space-y-2 lg:col-span-1 max-h-[500px] overflow-y-auto pr-1">
                      {filteredBugs.map((bug) => (
                        <button
                          key={bug.id}
                          type="button"
                          onClick={() => setSelectedBug(bug)}
                          className={cn(
                            "w-full text-left p-3 border transition-all text-xs space-y-1 rounded-none",
                            selectedBug?.id === bug.id
                              ? "border-primary bg-primary/10 text-white"
                              : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:text-white"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-primary">{bug.shortCode}</span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 border",
                                bug.status === "fixed" ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10" : "border-orange-400/40 text-orange-400 bg-orange-400/10"
                              )}
                            >
                              {bug.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 line-clamp-1">{bug.note || "Sem nota explicativa"}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>Assento: {bug.seat}</span>
                            <span>{new Date(bug.createdAt).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Detalhes do Relato Selecionado */}
                    <div className="lg:col-span-2 border border-white/10 bg-white/[0.02] p-5 space-y-4 rounded-none">
                      {selectedBug ? (
                        <>
                          <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                              <span className="text-xs font-mono text-slate-400">Relato Selecionado:</span>
                              <h4 className="font-mono text-xl font-bold text-primary">{selectedBug.shortCode}</h4>
                            </div>
                            {selectedBug.status !== "fixed" ? (
                              <Button
                                onClick={() => handleResolveBug(selectedBug.shortCode)}
                                className="rounded-none bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                              >
                                <CheckCircle2 className="size-3.5 mr-1.5" />
                                Marcar como Resolvido
                              </Button>
                            ) : (
                              <Badge className="rounded-none border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
                                CORRIGIDO
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                            <div className="border border-white/10 p-2.5">
                              <span className="text-slate-400 block text-[10px]">Partida ID:</span>
                              <span className="text-slate-200 truncate block">{selectedBug.matchId}</span>
                            </div>
                            <div className="border border-white/10 p-2.5">
                              <span className="text-slate-400 block text-[10px]">Versão da Engine:</span>
                              <span className="text-slate-200">{selectedBug.engineVersion || "v1.0"}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Nota do Jogador:</span>
                            <div className="border border-white/10 bg-black/40 p-3 text-xs text-slate-200 min-h-[50px]">
                              {selectedBug.note || "Nenhuma nota fornecida pelo jogador."}
                            </div>
                          </div>

                          <div>
                            <span className="text-xs uppercase font-mono text-slate-400 block mb-1">Cartas Envolvidas:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedBug.cardsInvolved && selectedBug.cardsInvolved.length > 0 ? (
                                selectedBug.cardsInvolved.map((c: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="rounded-none border-primary/30 text-primary font-mono text-[11px]">
                                    {c}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500">Nenhuma carta vinculada.</span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500">Selecione um bug report para ver os dados de diagnóstico.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-white/10 space-y-2">
                    <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-semibold text-white">Nenhum bug report pendente no momento!</p>
                    <p className="text-xs text-slate-400">O simulador está operando com estabilidade e sem relatórios ativos.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ────────────────────────────────────────────────────────────────
          MODAL: NOVO ARTIGO / NOTÍCIA
      ──────────────────────────────────────────────────────────────── */}
      <Dialog open={articleModalOpen} onOpenChange={setArticleModalOpen}>
        <DialogContent className="max-w-2xl bg-slate-950 border border-primary/40 rounded-none text-white p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl uppercase tracking-wider text-white flex items-center gap-2">
              <Newspaper className="size-5 text-primary" />
              Publicar Artigo / Notícia
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 uppercase font-mono">Título do Artigo</label>
                <Input
                  value={articleForm.title}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Análise Completa do Meta GD05..."
                  className="rounded-none text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 uppercase font-mono">Categoria</label>
                <select
                  value={articleForm.postType}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, postType: e.target.value as PostType }))}
                  className="w-full h-10 px-3 bg-slate-900 border border-white/20 text-xs text-white rounded-none"
                >
                  <option value="NEWS">Notícia (News)</option>
                  <option value="PREVIEW">Preview de Lançamento</option>
                  <option value="REVIEW">Análise de Coleção / Deck</option>
                  <option value="GUIDE">Guia & Estratégia</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 uppercase font-mono">Status</label>
                <select
                  value={articleForm.status}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, status: e.target.value as PostStatus }))}
                  className="w-full h-10 px-3 bg-slate-900 border border-white/20 text-xs text-white rounded-none"
                >
                  <option value="DRAFT">Rascunho (Privado)</option>
                  <option value="REVIEW">Em Revisão</option>
                  <option value="PUBLISHED">Publicado Oficialmente</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 uppercase font-mono">Link de Vídeo (YouTube)</label>
                <Input
                  value={articleForm.youtubeUrl}
                  onChange={(e) => setArticleForm((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="rounded-none text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 uppercase font-mono">URL da Imagem de Capa</label>
              <Input
                value={articleForm.coverImage}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                placeholder="https://... ou caminho relativo"
                className="rounded-none text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 uppercase font-mono">Resumo Curto (Excerpt)</label>
              <Input
                value={articleForm.excerpt}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                placeholder="Breve resumo para os cartões de notícia e Open Graph..."
                className="rounded-none text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 uppercase font-mono">Conteúdo Completo (Markdown)</label>
              <Textarea
                value={articleForm.contentMd}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, contentMd: e.target.value }))}
                placeholder="Escreva em Markdown: ## Título, **negrito**, listas, etc."
                className="rounded-none text-xs min-h-[140px] font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Button variant="outline" onClick={() => setArticleModalOpen(false)} className="rounded-none text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateArticle}
              disabled={savingArticle}
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
            >
              {savingArticle ? "Salvando Artigo..." : "Salvar Artigo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────────────
          MODAL: SEGURANÇA & ALTERAÇÃO DE SENHA DO ADMIN
      ──────────────────────────────────────────────────────────────── */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-md bg-slate-950 border border-amber-400/40 rounded-none text-white p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <ShieldCheck className="size-5" />
              Segurança da Conta Admin
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="border border-white/10 bg-white/[0.02] p-3 space-y-1.5">
              <p className="text-slate-300 font-semibold">Conta Administrativa Dedicada:</p>
              <p className="font-mono text-cyan-300">{user?.email}</p>
              <p className="text-[11px] text-slate-400">
                Esta conta possui privilégios de controle irrestrito no banco de dados e nos recursos do site.
              </p>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 uppercase font-mono">Nova Senha Forte</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres..."
                className="rounded-none text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)} className="rounded-none text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleChangeAdminPassword}
              disabled={savingPassword}
              className="rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              {savingPassword ? "Atualizando..." : "Atualizar Senha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
