/* Perfil/configurações v9 — dados pessoais + senha (ciente de login social) + avatar
 * de verdade, perfil visual + idioma do site + link público, resumo de conta. */
import { useEffect, useRef, useState } from "react";
import {
  BookMarked,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  HeartHandshake,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Upload,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFaction } from "@/contexts/FactionContext";
import { FactionSigil } from "@/components/theme/FactionSigil";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { validatePasswordStrength } from "@/lib/passwordStrength";
import { api, type ApiBinder } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { SupporterBadge } from "@/components/support/SupporterBadge";
import { CommunitySupportModal } from "@/components/support/CommunitySupportModal";
import { useSocial } from "@/components/social/SocialQuickMatchOverlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import defaultPilotAvatar from "@/assets/home/default_pilot_avatar.webp";

type FriendItem = {
  friendshipId: string;
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isSupporter?: boolean;
  online: boolean;
};

type PendingReceivedItem = {
  friendshipId: string;
  requester: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    isSupporter?: boolean;
  };
  createdAt: string;
};

type PendingSentItem = {
  friendshipId: string;
  addressee: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    isSupporter?: boolean;
  };
  createdAt: string;
};

export default function ProfilePage() {
  const { user, refreshMe, setCurrentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { faction, setFaction } = useFaction();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferredCardLanguage, setPreferredCardLanguage] = useState<"PT_BR" | "EN">("PT_BR");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Gestão de Esquadrão & Amigos
  const { startQuickMatch, openMailbox } = useSocial();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingReceivedItem[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingSentItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [addFriendInput, setAddFriendInput] = useState("");
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [friendsTab, setFriendsTab] = useState<"friends" | "received" | "sent">("friends");

  const loadFriendsData = async () => {
    try {
      setLoadingFriends(true);
      const [friendsRes, unreadRes] = await Promise.all([
        api.listFriends(),
        api.getUnreadMailCount().catch(() => ({ unreadCount: 0 })),
      ]);
      setFriends(friendsRes.friends || []);
      setPendingReceived(friendsRes.pendingReceived || []);
      setPendingSent(friendsRes.pendingSent || []);
      setUnreadMailCount(unreadRes.unreadCount || 0);
    } catch {
      // silencioso se falhar
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    loadFriendsData();
  }, []);

  const handleAcceptFriend = async (friendshipId: string, username: string) => {
    try {
      await api.acceptFriendRequest(friendshipId);
      toast.success(`Você e @${username} agora são amigos de esquadrão!`);
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aceitar solicitação.");
    }
  };

  const handleDeclineFriend = async (username: string) => {
    try {
      await api.removeFriend(username);
      toast.info("Solicitação recusada.");
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao recusar solicitação.");
    }
  };

  const handleCancelSentRequest = async (username: string) => {
    try {
      await api.removeFriend(username);
      toast.info("Solicitação cancelada.");
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar solicitação.");
    }
  };

  const handleRemoveFriend = async (username: string) => {
    if (!window.confirm(`Tem certeza que deseja desfazer o vínculo de amizade com @${username}?`)) return;
    try {
      await api.removeFriend(username);
      toast.info(`Vínculo de amizade com @${username} desfeito.`);
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao desfazer amizade.");
    }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = addFriendInput.trim().replace(/^@/, "");
    if (!cleanUsername) return;
    if (cleanUsername.toLowerCase() === user?.username?.toLowerCase()) {
      toast.warning("Você não pode enviar solicitação para si mesmo.");
      return;
    }
    setSendingFriendRequest(true);
    try {
      const res = await api.sendFriendRequest(cleanUsername);
      if (res.status === "FRIENDS") {
        toast.success(`Você e @${cleanUsername} agora são amigos!`);
      } else {
        toast.success(`Solicitação de amizade enviada para @${cleanUsername}!`);
      }
      setAddFriendInput("");
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar solicitação de amizade.");
    } finally {
      setSendingFriendRequest(false);
    }
  };

  // Gestão de Coleção / Pastas de Cartas do Usuário
  const [binders, setBinders] = useState<ApiBinder[]>([]);
  const [loadingBinders, setLoadingBinders] = useState(true);
  const [creatingBinder, setCreatingBinder] = useState(false);

  const loadBinders = async () => {
    setLoadingBinders(true);
    try {
      const data = await api.listMyBinders({ bypassCache: true });
      setBinders(data);
    } catch {
      // silencioso se falhar
    } finally {
      setLoadingBinders(false);
    }
  };

  useEffect(() => {
    loadBinders();
  }, []);

  const toggleBinderVisibility = async (binder: ApiBinder) => {
    try {
      const nextPublic = !binder.isPublic;
      await api.updateMyBinder(binder.id, { isPublic: nextPublic });
      setBinders((prev) => prev.map((b) => (b.id === binder.id ? { ...b, isPublic: nextPublic } : b)));
      toast.success(nextPublic ? "Pasta agora está PÚBLICA e acessível via link único." : "Pasta agora está PRIVADA.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar visibilidade da pasta.");
    }
  };

  const copyBinderShareLink = async (shareId: string) => {
    const url = `${window.location.origin}/binder/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link único da pasta copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const createInitialBinder = async () => {
    setCreatingBinder(true);
    try {
      await api.createBinder({
        name: "Minha Coleção de Cartas",
        description: "Cartas que possuo e coleciono no Anaheim Hub.",
        isPublic: true,
      });
      toast.success("Pasta de coleção criada com sucesso!");
      await loadBinders();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar pasta.");
    } finally {
      setCreatingBinder(false);
    }
  };

  useEffect(() => {
    refreshMe().catch(() => {});
  }, [refreshMe]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setBio(user?.bio ?? "");
    setPreferredCardLanguage(user?.preferredCardLanguage === "EN" ? "EN" : "PT_BR");
  }, [user]);

  const saveProfile = async () => {
    const updated = await api.updateMe({ displayName, bio, preferredCardLanguage, preferredTheme: theme });
    setCurrentUser(updated);
    await refreshMe();
    toast.success("Dados atualizados.");
  };

  const savePassword = async () => {
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      toast.error(validation.error || "A nova senha não atende aos requisitos de segurança.");
      return;
    }
    try {
      await api.updatePassword({ currentPassword: currentPassword || undefined, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      await refreshMe();
      toast.success(user?.hasPassword ? "Senha atualizada." : "Senha definida — agora você também pode entrar com email e senha.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar senha.");
    }
  };

  const handleAvatarPick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const updated = await api.uploadAvatar(formData);
      setCurrentUser(updated);
      await refreshMe();
      toast.success("Avatar atualizado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loginMethod = user?.hasPassword ? "Email e senha" : "Login com Google";
  const [resendingEmail, setResendingEmail] = useState(false);
  const resendVerification = async () => {
    setResendingEmail(true);
    try {
      const res = await api.resendVerificationEmail();
      toast.success(res?.message ?? "Enviamos um novo link de confirmação.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reenviar agora.");
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Configurações" }]}>
      <div className="space-y-6">
        {/* Bloco de Gestão de Coleção de Cartas & Pastas Públicas */}
        <Card className="panel-cut rounded-none border-primary/40 hero-surface">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary">Hangar de Colecionador</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-3xl uppercase tracking-wider">Minhas Cartas & Pastas Públicas</h2>
                  <Badge className="rounded-none border-primary/50 bg-primary/20 text-primary font-mono text-xs">BINDER SYSTEM</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                  Cadastre as cartas que você possui diferenciando as artes e impressões (Regular, Alt-Art, Parallel Rare, Promo ou Winner). Pastas marcadas como públicas geram um <strong className="text-white">link único exclusivo</strong> para compartilhar sua vitrine com a comunidade do Anaheim Hub.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/binders">
                    <BookMarked className="mr-2 size-4" />
                    Gerenciar Todas as Pastas
                  </Link>
                </Button>
                {binders.length === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={creatingBinder}
                    onClick={createInitialBinder}
                    className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    <Plus className="mr-2 size-4" />
                    {creatingBinder ? "Criando..." : "Criar Pasta de Coleção"}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Métricas rápidas de cartas e pastas */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Total de Pastas</p>
                <p className="mt-1 font-heading text-2xl text-white">{binders.length}</p>
              </div>
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Cartas Cadastradas</p>
                <p className="mt-1 font-heading text-2xl text-primary">
                  {binders.reduce((acc, b) => acc + (b._count?.items ?? b.items?.length ?? 0), 0)}
                </p>
              </div>
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Pastas Públicas</p>
                <p className="mt-1 font-heading text-2xl text-emerald-400">
                  {binders.filter((b) => b.isPublic).length}
                </p>
              </div>
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Diferenciação</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-300 font-mono">
                  <Sparkles className="size-3.5" />
                  <span>Alt-Arts Ativas</span>
                </div>
              </div>
            </div>

            {/* Listagem das pastas ou estado vazio */}
            {loadingBinders ? (
              <p className="text-sm text-slate-400 py-4 text-center">Carregando dados da coleção...</p>
            ) : binders.length === 0 ? (
              <div className="panel-cut border border-dashed border-white/20 bg-slate-950/40 p-6 text-center">
                <BookMarked className="mx-auto size-8 text-slate-500 mb-2" />
                <h3 className="font-heading text-lg uppercase text-slate-300">Você ainda não possui nenhuma pasta de cartas</h3>
                <p className="mt-1 text-sm text-slate-400 max-w-lg mx-auto">
                  Crie sua primeira pasta para cadastrar suas cartas físicas, escolher versões de arte específicas e compartilhar seu fichário publicamente.
                </p>
                <Button
                  type="button"
                  onClick={createInitialBinder}
                  disabled={creatingBinder}
                  className="mt-4 rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="mr-2 size-4" />
                  {creatingBinder ? "Criando pasta..." : "Criar Minha Pasta Agora"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-mono">Suas Pastas & Links Únicos de Compartilhamento</p>
                  <p className="text-[11px] text-slate-400 hidden sm:block">Dica: No editor, use o ícone de galeria para selecionar artes alternativas.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {binders.map((binder) => {
                    const itemCount = binder._count?.items ?? binder.items?.length ?? 0;
                    const shareUrl = `${window.location.origin}/binder/${binder.shareId}`;
                    return (
                      <div key={binder.id} className="panel-cut border border-white/15 bg-slate-950/70 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-heading text-xl uppercase text-white hover:text-primary transition">
                              <Link href={`/binders/${binder.id}`}>{binder.name}</Link>
                            </h4>
                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{binder.description || "Sem descrição pública."}</p>
                          </div>
                          <Badge className={`rounded-none border text-[10px] font-mono uppercase ${binder.isPublic ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-slate-500/40 bg-slate-500/10 text-slate-400"}`}>
                            {binder.isPublic ? "Pública" : "Privada"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono text-primary font-bold">{itemCount}</span> cartas cadastradas
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => toggleBinderVisibility(binder)}
                            className="text-primary hover:underline font-mono text-[11px]"
                          >
                            {binder.isPublic ? "Mudar para Privada" : "Tornar Pública"}
                          </button>
                        </div>

                        {binder.isPublic ? (
                          <div className="panel-cut border border-emerald-500/20 bg-emerald-950/20 p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 flex items-center gap-1">
                                <Globe className="size-3" />
                                Link Único Compartilhável:
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => copyBinderShareLink(binder.shareId)}
                                className="h-6 rounded-none border-emerald-400/40 bg-emerald-400/10 text-[10px] text-emerald-300 hover:bg-emerald-400/20"
                              >
                                <Copy className="mr-1 size-3" />
                                Copiar Link
                              </Button>
                            </div>
                            <div className="bg-slate-950/80 p-1.5 border border-white/10 font-mono text-[11px] text-slate-300 truncate select-all">
                              {shareUrl}
                            </div>
                          </div>
                        ) : (
                          <div className="panel-cut border border-slate-700/40 bg-slate-900/30 p-2.5 flex items-center gap-2 text-xs text-slate-400">
                            <Lock className="size-3.5 text-slate-500 shrink-0" />
                            <span>Pasta privada. Marque como pública para liberar o link único de compartilhamento.</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                          <Button asChild size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
                            <Link href={`/binders/${binder.id}`}>
                              Cadastrar / Editar Cartas
                            </Link>
                          </Button>
                          {binder.isPublic ? (
                            <Button asChild size="sm" variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs text-white hover:bg-white/10">
                              <a href={`/binder/${binder.shareId}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-1.5 size-3" />
                                Ver Vitrine
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bloco de Central de Esquadrão & Pilotos Vinculados */}
        <Card className="panel-cut rounded-none border-cyan-500/30 hero-surface">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-mono">Rede Social & Matchmaking</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-3xl uppercase tracking-wider text-white">Central de Esquadrão & Amigos</h2>
                  <Badge className="rounded-none border-cyan-500/50 bg-cyan-500/20 text-cyan-300 font-mono text-xs">TACTICAL SOCIAL HUB</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                  Gerencie seus vínculos de amizade. Pilotos amigos podem enviar correspondências táticas assíncronas (Caixa Postal / E-mail) e convidar para <strong className="text-rose-400">Partidas Rápidas</strong> com 1 clique direto no simulador quando estiverem online simultaneamente.
                </p>
              </div>

              {/* Acesso rápido à Caixa Postal */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => openMailbox()}
                  className="relative rounded-none border border-cyan-500/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 uppercase tracking-wider text-xs font-mono"
                >
                  <Mail className="mr-2 size-4 text-cyan-400" />
                  Caixa Postal de Piloto
                  {unreadMailCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      {unreadMailCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {/* Formulário para Adicionar Piloto + Abas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Abas */}
              <div className="flex items-center gap-1 border-b border-white/10 pb-1 sm:border-0 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFriendsTab("friends")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
                    friendsTab === "friends"
                      ? "border-cyan-400 text-cyan-300 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="inline mr-1.5 size-3.5" />
                  Amigos ({friends.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFriendsTab("received")}
                  className={`relative px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
                    friendsTab === "received"
                      ? "border-amber-400 text-amber-300 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <UserPlus className="inline mr-1.5 size-3.5" />
                  Recebidas ({pendingReceived.length})
                  {pendingReceived.length > 0 && (
                    <span className="ml-1.5 inline-block size-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFriendsTab("sent")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
                    friendsTab === "sent"
                      ? "border-slate-400 text-slate-200 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Clock className="inline mr-1.5 size-3.5" />
                  Enviadas ({pendingSent.length})
                </button>
              </div>

              {/* Input Adicionar Piloto */}
              <form onSubmit={handleSendFriendRequest} className="flex items-center gap-2 max-w-sm w-full">
                <Input
                  type="text"
                  placeholder="Nome de usuário do piloto (@...)"
                  value={addFriendInput}
                  onChange={(e) => setAddFriendInput(e.target.value)}
                  className="h-8 rounded-none bg-slate-950/80 border-white/15 text-xs font-mono"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={sendingFriendRequest || !addFriendInput.trim()}
                  className="h-8 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs shrink-0"
                >
                  <UserPlus className="mr-1.5 size-3.5" />
                  {sendingFriendRequest ? "Enviando..." : "Adicionar"}
                </Button>
              </form>
            </div>

            {/* Conteúdo das Abas */}
            {loadingFriends ? (
              <p className="text-sm text-slate-400 py-6 text-center font-mono">Sincronizando esquadrão...</p>
            ) : friendsTab === "friends" ? (
              friends.length === 0 ? (
                <div className="panel-cut border border-dashed border-white/15 bg-slate-950/40 p-6 text-center">
                  <Users className="mx-auto size-8 text-slate-500 mb-2" />
                  <h4 className="font-heading text-lg uppercase text-slate-300">Nenhum piloto no esquadrão ainda</h4>
                  <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                    Use o campo acima para adicionar outros pilotos ou visite os perfis públicos de criadores de decks para solicitar amizade.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {friends.map((f) => (
                    <div
                      key={f.id}
                      className="panel-cut border border-white/10 bg-slate-950/70 p-3.5 flex flex-col justify-between gap-3 transition hover:border-cyan-500/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={f.avatarUrl || defaultPilotAvatar}
                            alt={f.displayName}
                            className="size-10 rounded-full border border-white/15 object-cover"
                          />
                          <span
                            className={`absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-slate-950 ${
                              f.online ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                            }`}
                            title={f.online ? "Online no Hangar" : "Offline"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-heading text-sm uppercase text-white truncate">{f.displayName}</span>
                            {f.isSupporter && <SupporterBadge size="sm" />}
                          </div>
                          <p className="text-xs text-slate-400 font-mono truncate">@{f.username}</p>
                          <span className={`inline-block text-[10px] font-mono ${f.online ? "text-emerald-400" : "text-slate-500"}`}>
                            {f.online ? "● Conectado agora" : "○ Desconectado"}
                          </span>
                        </div>
                      </div>

                      {/* Botões de Ação do Amigo */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                        {/* Partida Rápida */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!f.online) {
                              toast.warning(`@${f.username} está offline. Convites de Partida Rápida exigem que ambos os pilotos estejam conectados.`);
                              return;
                            }
                            startQuickMatch(f.id, f.username, f.displayName);
                          }}
                          className={`h-7 rounded-none text-[11px] uppercase tracking-wider flex-1 ${
                            f.online
                              ? "border-rose-500/60 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                              : "border-white/10 bg-white/5 text-slate-500 hover:bg-white/10"
                          }`}
                          title={f.online ? "Desafiar para Partida Rápida com 1 clique" : "Piloto offline"}
                        >
                          <Swords className={`mr-1 size-3 ${f.online ? "text-rose-400" : ""}`} />
                          Partida
                        </Button>

                        {/* Mensagem Assíncrona */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openMailbox(f.username)}
                          className="h-7 rounded-none border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[11px] uppercase tracking-wider px-2"
                          title="Enviar correspondência tática (Caixa Postal)"
                        >
                          <Mail className="size-3" />
                        </Button>

                        {/* Ver Perfil Público */}
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-none text-slate-400 hover:text-white px-2"
                          title="Ver Perfil Público"
                        >
                          <Link href={`/u/${f.username}`}>
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>

                        {/* Desfazer Amizade */}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFriend(f.username)}
                          className="h-7 rounded-none text-slate-500 hover:text-rose-400 px-2"
                          title="Desfazer amizade"
                        >
                          <UserMinus className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : friendsTab === "received" ? (
              pendingReceived.length === 0 ? (
                <div className="panel-cut border border-dashed border-white/15 bg-slate-950/40 p-6 text-center">
                  <UserCheck className="mx-auto size-8 text-slate-500 mb-2" />
                  <p className="text-xs text-slate-400 font-mono">Nenhuma solicitação de amizade pendente no momento.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingReceived.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="panel-cut border border-amber-500/30 bg-slate-950/70 p-3.5 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={req.requester.avatarUrl || defaultPilotAvatar}
                          alt={req.requester.displayName}
                          className="size-10 rounded-full border border-white/15 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-heading text-sm uppercase text-white truncate block">
                            {req.requester.displayName}
                          </span>
                          <p className="text-xs text-slate-400 font-mono truncate">@{req.requester.username}</p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Recebido em {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAcceptFriend(req.friendshipId, req.requester.username)}
                          className="h-7 flex-1 rounded-none bg-emerald-600 text-white hover:bg-emerald-500 text-xs uppercase tracking-wider"
                        >
                          <Check className="mr-1 size-3" />
                          Aceitar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineFriend(req.requester.username)}
                          className="h-7 flex-1 rounded-none border-white/15 bg-white/5 text-slate-300 hover:text-white text-xs uppercase tracking-wider"
                        >
                          <X className="mr-1 size-3" />
                          Recusar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              pendingSent.length === 0 ? (
                <div className="panel-cut border border-dashed border-white/15 bg-slate-950/40 p-6 text-center">
                  <Clock className="mx-auto size-8 text-slate-500 mb-2" />
                  <p className="text-xs text-slate-400 font-mono">Você não tem solicitações enviadas aguardando resposta.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingSent.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="panel-cut border border-white/10 bg-slate-950/70 p-3.5 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={req.addressee.avatarUrl || defaultPilotAvatar}
                          alt={req.addressee.displayName}
                          className="size-10 rounded-full border border-white/15 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-heading text-sm uppercase text-white truncate block">
                            {req.addressee.displayName}
                          </span>
                          <p className="text-xs text-slate-400 font-mono truncate">@{req.addressee.username}</p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Aguardando resposta desde {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelSentRequest(req.addressee.username)}
                          className="h-7 w-full rounded-none border-white/15 bg-white/5 text-slate-400 hover:text-white text-xs uppercase tracking-wider"
                        >
                          <X className="mr-1.5 size-3" />
                          Cancelar Solicitação
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] 2xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Dados pessoais</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-4xl uppercase">Sua conta</h2>
                  {user?.isSupporter ? <SupporterBadge /> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-400 light:text-slate-600">Nome, avatar e senha de acesso. O que já vem do seu login social (Google) não pode ser editado por aqui.</p>
              </div>

              <div className="flex items-center gap-4">
                <button type="button" onClick={handleAvatarPick} disabled={uploadingAvatar} className="group relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-slate-950/60 transition hover:border-primary/60 disabled:opacity-60">
                  <img loading="lazy" decoding="async" src={user?.avatarUrl || defaultPilotAvatar} alt={user?.displayName || "Piloto"} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 opacity-0 transition group-hover:opacity-100">
                    <Upload className="size-5 text-white" />
                  </div>
                </button>
                <div>
                  <Button type="button" variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={handleAvatarPick} disabled={uploadingAvatar}>{uploadingAvatar ? "Enviando…" : "Trocar avatar"}</Button>
                  <p className="mt-1.5 text-xs text-slate-500">JPG, PNG ou WebP.</p>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome de exibição" className="rounded-none" />
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio pública" className="min-h-24 rounded-none" />
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveProfile}><Save className="mr-2 size-4" />Salvar dados</Button>

              <div className="border-t border-white/10 pt-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{user?.hasPassword ? "Alterar senha" : "Definir senha"}</p>
                {!user?.hasPassword ? <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-400 light:text-slate-600">Sua conta usa login do Google e ainda não tem senha própria. Você pode definir uma agora — isso não desativa o login com Google, só adiciona uma segunda forma de entrar.</p> : null}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {user?.hasPassword ? <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Senha atual" className="rounded-none" /> : null}
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha (mín. 8 caracteres)" className="rounded-none" />
                </div>
                {newPassword ? (
                  <div className="mt-3 rounded border border-white/10 bg-slate-900/40 p-3 light:bg-slate-100/70">
                    <PasswordStrengthMeter password={newPassword} />
                  </div>
                ) : null}
                <Button className="mt-3 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={savePassword}><KeyRound className="mr-2 size-4" />{user?.hasPassword ? "Alterar senha" : "Definir senha"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="space-y-4 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Aparência e idioma</p>
              <div>
                <label className="text-xs text-slate-500">Perfil visual</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["hangar", "zeon"] as const).map((option) => (
                    <button key={option} type="button" onClick={() => setFaction(option)} className={`flex items-center gap-2.5 border p-2.5 text-left transition ${faction === option ? "border-primary/60 bg-primary/10" : "border-white/15 bg-white/5 hover:border-white/30"}`}>
                      {option === "zeon" ? <FactionSigil className="size-6 shrink-0 text-primary" /> : <div className="size-6 shrink-0 border border-white/30" />}
                      <span className="text-sm capitalize">{option}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">Muda a identidade visual do site (cor, cantos, tipografia). Mais facções chegam depois.</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">Modo de cor</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")} className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                  <option value="dark">Escuro</option>
                  <option value="light">Claro</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Texto das cartas</label>
                <select value={preferredCardLanguage} onChange={(e) => setPreferredCardLanguage(e.target.value as "PT_BR" | "EN")} className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                  <option value="PT_BR">Português</option>
                  <option value="EN">Inglês</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Idioma do site</label>
                <select defaultValue="pt-BR" className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en" disabled>English (em breve)</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500">Idioma padrão da interface de navegação e menus.</p>
              </div>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveProfile}><Save className="mr-2 size-4" />Salvar preferências</Button>
              {user?.username ? (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs text-slate-500">Seu perfil público:</p>
                  <a href={`/u/${user.username}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">
                    {window.location.origin}/u/{user.username}
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Resumo da conta</p>
              <div className="mt-5 space-y-3">
                <div className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Email</span>
                  <span className="text-sm">{user?.email}</span>
                </div>
                <div className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Forma de acesso</span>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{loginMethod}</Badge>
                </div>
                <div className="panel-cut flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">E-mail</span>
                  {user?.emailVerified ? (
                    <Badge className="rounded-none border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">Confirmado</Badge>
                  ) : (
                    <span className="flex flex-wrap items-center gap-3">
                      <Badge className="rounded-none border border-amber-400/40 bg-amber-400/10 text-amber-300">Não confirmado</Badge>
                      <Button type="button" variant="outline" size="sm" disabled={resendingEmail} onClick={resendVerification} className="rounded-none text-xs">
                        {resendingEmail ? "Enviando..." : "Reenviar link"}
                      </Button>
                    </span>
                  )}
                </div>
                <div className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Usuário</span>
                  <span className="text-sm">@{user?.username}</span>
                </div>
                <div className="panel-cut flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Apoio Comunitário</span>
                  {user?.isSupporter ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <SupporterBadge size="sm" />
                      {user.supporterSince ? (
                        <span className="text-xs text-slate-400">
                          desde {new Date(user.supporterSince).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Ainda não apoia</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSupportModalOpen(true)}
                        className="h-7 rounded-none border-amber-400/40 bg-amber-400/10 text-xs text-amber-300 hover:bg-amber-400/20"
                      >
                        <HeartHandshake className="mr-1.5 size-3 text-amber-400" />
                        Apoiar via Pix
                      </Button>
                    </div>
                  )}
                </div>
                {user?.role === "ADMIN" ? (
                  <div className="panel-cut border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="size-4 text-amber-400" />
                        <span className="text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold">Credenciais de Administrador</span>
                      </div>
                      <Badge className="rounded-none border-amber-400/50 bg-amber-400/20 text-amber-200 text-[10px] font-mono">NÍVEL ALPHA</Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Sua conta possui acesso administrativo total. A governança de cartas, regras, usuários, torneios e CMS é operada através do Console Administrativo dedicado, separado do portal de jogador.
                    </p>
                    <Button asChild size="sm" className="w-full rounded-none bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 uppercase tracking-wider text-xs">
                      <Link href="/admin">
                        <ShieldCheck className="mr-2 size-4" />
                        Abrir Console de Administração
                      </Link>
                    </Button>
                  </div>
                ) : null}
                <div className="panel-cut flex items-center gap-3 border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                  <span className="text-xs leading-5 text-slate-400 dark:text-slate-400 light:text-slate-600">Sua senha nunca é armazenada em texto puro, e o login com Google não expõe sua senha do Google pra este site.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
      <CommunitySupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} />
    </PortalShell>
  );
}
