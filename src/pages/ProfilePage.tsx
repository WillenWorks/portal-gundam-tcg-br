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
import { useSiteLanguage } from "@/i18n/siteLanguage";

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
  const { tr, lang: siteLang, setLanguage: setSiteLanguage, locale } = useSiteLanguage();
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
      toast.success(tr(`Você e @${username} agora são amigos de esquadrão!`, `You and @${username} are now friends!`));
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao aceitar solicitação.", "Couldn't accept the request."));
    }
  };

  const handleDeclineFriend = async (username: string) => {
    try {
      await api.removeFriend(username);
      toast.info(tr("Solicitação recusada.", "Request declined."));
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao recusar solicitação.", "Couldn't decline the request."));
    }
  };

  const handleCancelSentRequest = async (username: string) => {
    try {
      await api.removeFriend(username);
      toast.info(tr("Solicitação cancelada.", "Request cancelled."));
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao cancelar solicitação.", "Couldn't cancel the request."));
    }
  };

  const handleRemoveFriend = async (username: string) => {
    if (!window.confirm(tr(`Tem certeza que deseja desfazer o vínculo de amizade com @${username}?`, `Remove @${username} from your friends?`))) return;
    try {
      await api.removeFriend(username);
      toast.info(tr(`Vínculo de amizade com @${username} desfeito.`, `@${username} removed from your friends.`));
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao desfazer amizade.", "Couldn't remove the friend."));
    }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = addFriendInput.trim().replace(/^@/, "");
    if (!cleanUsername) return;
    if (cleanUsername.toLowerCase() === user?.username?.toLowerCase()) {
      toast.warning(tr("Você não pode enviar solicitação para si mesmo.", "You can't send a request to yourself."));
      return;
    }
    setSendingFriendRequest(true);
    try {
      const res = await api.sendFriendRequest(cleanUsername);
      if (res.status === "FRIENDS") {
        toast.success(tr(`Você e @${cleanUsername} agora são amigos!`, `You and @${cleanUsername} are now friends!`));
      } else {
        toast.success(tr(`Solicitação de amizade enviada para @${cleanUsername}!`, `Friend request sent to @${cleanUsername}!`));
      }
      setAddFriendInput("");
      await loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao enviar solicitação de amizade.", "Couldn't send the friend request."));
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
      toast.success(nextPublic ? tr("Pasta agora está PÚBLICA e acessível via link único.", "Binder is now PUBLIC and reachable through its unique link.") : tr("Pasta agora está PRIVADA.", "Binder is now PRIVATE."));
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao alterar visibilidade da pasta.", "Couldn't change the binder visibility."));
    }
  };

  const copyBinderShareLink = async (shareId: string) => {
    const url = `${window.location.origin}/binder/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(tr("Link único da pasta copiado para a área de transferência!", "Binder link copied to the clipboard!"));
    } catch {
      toast.error(tr("Não foi possível copiar o link.", "Couldn't copy the link."));
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
      toast.success(tr("Pasta de coleção criada com sucesso!", "Collection binder created!"));
      await loadBinders();
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao criar pasta.", "Couldn't create the binder."));
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
    toast.success(tr("Dados atualizados.", "Saved."));
  };

  const savePassword = async () => {
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      toast.error(validation.error || tr("A nova senha não atende aos requisitos de segurança.", "The new password doesn't meet the security requirements."));
      return;
    }
    try {
      await api.updatePassword({ currentPassword: currentPassword || undefined, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      await refreshMe();
      toast.success(user?.hasPassword ? tr("Senha atualizada.", "Password updated.") : tr("Senha definida — agora você também pode entrar com email e senha.", "Password set — you can now also sign in with email and password."));
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao salvar senha.", "Couldn't save the password."));
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
      toast.success(tr("Avatar atualizado.", "Avatar updated."));
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao enviar avatar.", "Couldn't upload the avatar."));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loginMethod = user?.hasPassword ? tr("Email e senha", "Email and password") : tr("Login com Google", "Google sign-in");
  const [resendingEmail, setResendingEmail] = useState(false);
  const resendVerification = async () => {
    setResendingEmail(true);
    try {
      const res = await api.resendVerificationEmail();
      toast.success(res?.message ?? tr("Enviamos um novo link de confirmação.", "We sent a new confirmation link."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Não foi possível reenviar agora.", "Couldn't resend right now."));
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <PortalShell breadcrumbs={[{ label: tr("Configurações", "Settings") }]}>
      <div className="space-y-6">
        {/* Bloco de Gestão de Coleção de Cartas & Pastas Públicas */}
        <Card className="panel-cut rounded-none border-primary/40 hero-surface">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary">{tr("Hangar de Colecionador", "Collector's Hangar")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-3xl uppercase tracking-wider">{tr("Minhas Cartas & Pastas Públicas", "My Cards & Public Binders")}</h2>
                  <Badge className="rounded-none border-primary/50 bg-primary/20 text-primary font-mono text-xs">BINDER SYSTEM</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                  {tr("Cadastre as cartas que você possui diferenciando as artes e impressões (Regular, Alt-Art, Parallel Rare, Promo ou Winner). Pastas marcadas como públicas geram um", "Register the cards you own, telling apart arts and prints (Regular, Alt-Art, Parallel Rare, Promo or Winner). Public binders get a")} <strong className="text-white">{tr("link único exclusivo", "unique link")}</strong> {tr("para compartilhar sua vitrine com a comunidade do Anaheim Hub.", "to share your showcase with the Anaheim Hub community.")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/binders">
                    <BookMarked className="mr-2 size-4" />
                    {tr("Gerenciar Todas as Pastas", "Manage All Binders")}
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
                    {creatingBinder ? tr("Criando...", "Creating...") : tr("Criar Pasta de Coleção", "Create Collection Binder")}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Métricas rápidas de cartas e pastas */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{tr("Total de Pastas", "Total Binders")}</p>
                <p className="mt-1 font-heading text-2xl text-white">{binders.length}</p>
              </div>
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{tr("Cartas Cadastradas", "Cards Registered")}</p>
                <p className="mt-1 font-heading text-2xl text-primary">
                  {binders.reduce((acc, b) => acc + (b._count?.items ?? b.items?.length ?? 0), 0)}
                </p>
              </div>
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{tr("Pastas Públicas", "Public Binders")}</p>
                <p className="mt-1 font-heading text-2xl text-emerald-400">
                  {binders.filter((b) => b.isPublic).length}
                </p>
              </div>
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{tr("Diferenciação", "Variants")}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-300 font-mono">
                  <Sparkles className="size-3.5" />
                  <span>{tr("Alt-Arts Ativas", "Active Alt-Arts")}</span>
                </div>
              </div>
            </div>

            {/* Listagem das pastas ou estado vazio */}
            {loadingBinders ? (
              <p className="text-sm text-slate-400 py-4 text-center">{tr("Carregando dados da coleção...", "Loading collection...")}</p>
            ) : binders.length === 0 ? (
              <div className="panel-cut border border-dashed border-white/20 bg-slate-950/40 p-6 text-center">
                <BookMarked className="mx-auto size-8 text-slate-500 mb-2" />
                <h3 className="font-heading text-lg uppercase text-slate-300">{tr("Você ainda não possui nenhuma pasta de cartas", "You don't have any card binders yet")}</h3>
                <p className="mt-1 text-sm text-slate-400 max-w-lg mx-auto">
                  {tr("Crie sua primeira pasta para cadastrar suas cartas físicas, escolher versões de arte específicas e compartilhar seu fichário publicamente.", "Create your first binder to register your physical cards, pick specific art versions and share your binder publicly.")}
                </p>
                <Button
                  type="button"
                  onClick={createInitialBinder}
                  disabled={creatingBinder}
                  className="mt-4 rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="mr-2 size-4" />
                  {creatingBinder ? tr("Criando pasta...", "Creating binder...") : tr("Criar Minha Pasta Agora", "Create My Binder Now")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-mono">{tr("Suas Pastas & Links Únicos de Compartilhamento", "Your Binders & Share Links")}</p>
                  <p className="text-[11px] text-slate-400 hidden sm:block">{tr("Dica: No editor, use o ícone de galeria para selecionar artes alternativas.", "Tip: in the editor, use the gallery icon to pick alternate arts.")}</p>
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
                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{binder.description || tr("Sem descrição pública.", "No public description.")}</p>
                          </div>
                          <Badge className={`rounded-none border text-[10px] font-mono uppercase ${binder.isPublic ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-slate-500/40 bg-slate-500/10 text-slate-400"}`}>
                            {binder.isPublic ? tr("Pública", "Public") : tr("Privada", "Private")}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono text-primary font-bold">{itemCount}</span> {tr("cartas cadastradas", "cards registered")}
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => toggleBinderVisibility(binder)}
                            className="text-primary hover:underline font-mono text-[11px]"
                          >
                            {binder.isPublic ? tr("Mudar para Privada", "Make Private") : tr("Tornar Pública", "Make Public")}
                          </button>
                        </div>

                        {binder.isPublic ? (
                          <div className="panel-cut border border-emerald-500/20 bg-emerald-950/20 p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 flex items-center gap-1">
                                <Globe className="size-3" />
                                {tr("Link Único Compartilhável:", "Shareable link:")}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => copyBinderShareLink(binder.shareId)}
                                className="h-6 rounded-none border-emerald-400/40 bg-emerald-400/10 text-[10px] text-emerald-300 hover:bg-emerald-400/20"
                              >
                                <Copy className="mr-1 size-3" />
                                {tr("Copiar Link", "Copy Link")}
                              </Button>
                            </div>
                            <div className="bg-slate-950/80 p-1.5 border border-white/10 font-mono text-[11px] text-slate-300 truncate select-all">
                              {shareUrl}
                            </div>
                          </div>
                        ) : (
                          <div className="panel-cut border border-slate-700/40 bg-slate-900/30 p-2.5 flex items-center gap-2 text-xs text-slate-400">
                            <Lock className="size-3.5 text-slate-500 shrink-0" />
                            <span>{tr("Pasta privada. Marque como pública para liberar o link único de compartilhamento.", "Private binder. Make it public to get a share link.")}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                          <Button asChild size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
                            <Link href={`/binders/${binder.id}`}>
                              {tr("Cadastrar / Editar Cartas", "Add / Edit Cards")}
                            </Link>
                          </Button>
                          {binder.isPublic ? (
                            <Button asChild size="sm" variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs text-white hover:bg-white/10">
                              <a href={`/binder/${binder.shareId}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-1.5 size-3" />
                                {tr("Ver Vitrine", "View Showcase")}
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
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-mono">{tr("Rede Social & Matchmaking", "Social & Matchmaking")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-3xl uppercase tracking-wider text-white">{tr("Central de Esquadrão & Amigos", "Friends & Squad")}</h2>
                  <Badge className="rounded-none border-cyan-500/50 bg-cyan-500/20 text-cyan-300 font-mono text-xs">TACTICAL SOCIAL HUB</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                  {tr("Gerencie seus vínculos de amizade. Pilotos amigos podem enviar correspondências táticas assíncronas (Caixa Postal / E-mail) e convidar para", "Manage your friends. Friends can send each other messages (Mailbox / email) and invite each other to")} <strong className="text-rose-400">{tr("Partidas Rápidas", "Quick Matches")}</strong> {tr("com 1 clique direto no simulador quando estiverem online simultaneamente.", "with one click in the simulator when both are online.")}
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
                  {tr("Caixa Postal de Piloto", "Player Mailbox")}
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
                  {tr("Amigos", "Friends")} ({friends.length})
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
                  {tr("Recebidas", "Received")} ({pendingReceived.length})
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
                  {tr("Enviadas", "Sent")} ({pendingSent.length})
                </button>
              </div>

              {/* Input Adicionar Piloto */}
              <form onSubmit={handleSendFriendRequest} className="flex items-center gap-2 max-w-sm w-full">
                <Input
                  type="text"
                  placeholder={tr("Nome de usuário do piloto (@...)", "Player username (@...)")}
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
                  {sendingFriendRequest ? tr("Enviando...", "Sending...") : "Adicionar"}
                </Button>
              </form>
            </div>

            {/* Conteúdo das Abas */}
            {loadingFriends ? (
              <p className="text-sm text-slate-400 py-6 text-center font-mono">{tr("Sincronizando esquadrão...", "Loading friends...")}</p>
            ) : friendsTab === "friends" ? (
              friends.length === 0 ? (
                <div className="panel-cut border border-dashed border-white/15 bg-slate-950/40 p-6 text-center">
                  <Users className="mx-auto size-8 text-slate-500 mb-2" />
                  <h4 className="font-heading text-lg uppercase text-slate-300">{tr("Nenhum piloto no esquadrão ainda", "No friends yet")}</h4>
                  <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                    {tr("Use o campo acima para adicionar outros pilotos ou visite os perfis públicos de criadores de decks para solicitar amizade.", "Use the field above to add other players, or visit deck creators' public profiles to send a friend request.")}
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
                            title={f.online ? tr("Online no Hangar", "Online") : "Offline"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-heading text-sm uppercase text-white truncate">{f.displayName}</span>
                            {f.isSupporter && <SupporterBadge size="sm" />}
                          </div>
                          <p className="text-xs text-slate-400 font-mono truncate">@{f.username}</p>
                          <span className={`inline-block text-[10px] font-mono ${f.online ? "text-emerald-400" : "text-slate-500"}`}>
                            {f.online ? tr("● Conectado agora", "● Online now") : tr("○ Desconectado", "○ Offline")}
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
                              toast.warning(tr(`@${f.username} está offline. Convites de Partida Rápida exigem que ambos os pilotos estejam conectados.`, `@${f.username} is offline. Quick Match invites need both players online.`));
                              return;
                            }
                            startQuickMatch(f.id, f.username, f.displayName);
                          }}
                          className={`h-7 rounded-none text-[11px] uppercase tracking-wider flex-1 ${
                            f.online
                              ? "border-rose-500/60 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                              : "border-white/10 bg-white/5 text-slate-500 hover:bg-white/10"
                          }`}
                          title={f.online ? tr("Desafiar para Partida Rápida com 1 clique", "Challenge to a Quick Match with one click") : tr("Piloto offline", "Player offline")}
                        >
                          <Swords className={`mr-1 size-3 ${f.online ? "text-rose-400" : ""}`} />
                          {tr("Partida", "Match")}
                        </Button>

                        {/* Mensagem Assíncrona */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openMailbox(f.username)}
                          className="h-7 rounded-none border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[11px] uppercase tracking-wider px-2"
                          title={tr("Enviar correspondência tática (Caixa Postal)", "Send a message (Mailbox)")}
                        >
                          <Mail className="size-3" />
                        </Button>

                        {/* Ver Perfil Público */}
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-none text-slate-400 hover:text-white px-2"
                          title={tr("Ver Perfil Público", "View Public Profile")}
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
                          title={tr("Desfazer amizade", "Remove friend")}
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
                  <p className="text-xs text-slate-400 font-mono">{tr("Nenhuma solicitação de amizade pendente no momento.", "No pending friend requests right now.")}</p>
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
                            {tr("Recebido em", "Received on")} {new Date(req.createdAt).toLocaleDateString(locale)}
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
                          {tr("Aceitar", "Accept")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineFriend(req.requester.username)}
                          className="h-7 flex-1 rounded-none border-white/15 bg-white/5 text-slate-300 hover:text-white text-xs uppercase tracking-wider"
                        >
                          <X className="mr-1 size-3" />
                          {tr("Recusar", "Decline")}
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
                  <p className="text-xs text-slate-400 font-mono">{tr("Você não tem solicitações enviadas aguardando resposta.", "You have no sent requests waiting for a reply.")}</p>
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
                            {tr("Aguardando resposta desde", "Waiting for a reply since")} {new Date(req.createdAt).toLocaleDateString(locale)}
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
                          {tr("Cancelar Solicitação", "Cancel Request")}
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
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{tr("Dados pessoais", "Personal details")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-4xl uppercase">{tr("Sua conta", "Your account")}</h2>
                  {user?.isSupporter ? <SupporterBadge /> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-400 light:text-slate-600">{tr("Nome, avatar e senha de acesso. O que já vem do seu login social (Google) não pode ser editado por aqui.", "Name, avatar and password. What comes from your social sign-in (Google) can't be edited here.")}</p>
              </div>

              <div className="flex items-center gap-4">
                <button type="button" onClick={handleAvatarPick} disabled={uploadingAvatar} className="group relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-slate-950/60 transition hover:border-primary/60 disabled:opacity-60">
                  <img loading="lazy" decoding="async" src={user?.avatarUrl || defaultPilotAvatar} alt={user?.displayName || "Piloto"} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 opacity-0 transition group-hover:opacity-100">
                    <Upload className="size-5 text-white" />
                  </div>
                </button>
                <div>
                  <Button type="button" variant="outline" size="sm" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={handleAvatarPick} disabled={uploadingAvatar}>{uploadingAvatar ? tr("Enviando…", "Uploading…") : tr("Trocar avatar", "Change avatar")}</Button>
                  <p className="mt-1.5 text-xs text-slate-500">{tr("JPG, PNG ou WebP.", "JPG, PNG or WebP.")}</p>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={tr("Nome de exibição", "Display name")} className="rounded-none" />
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={tr("Bio pública", "Public bio")} className="min-h-24 rounded-none" />
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveProfile}><Save className="mr-2 size-4" />{tr("Salvar dados", "Save")}</Button>

              <div className="border-t border-white/10 pt-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{user?.hasPassword ? tr("Alterar senha", "Change password") : tr("Definir senha", "Set password")}</p>
                {!user?.hasPassword ? <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-400 light:text-slate-600">{tr("Sua conta usa login do Google e ainda não tem senha própria. Você pode definir uma agora — isso não desativa o login com Google, só adiciona uma segunda forma de entrar.", "Your account uses Google sign-in and has no password of its own. You can set one now — it doesn't turn off Google sign-in, it just adds a second way to sign in.")}</p> : null}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {user?.hasPassword ? <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={tr("Senha atual", "Current password")} className="rounded-none" /> : null}
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={tr("Nova senha (mín. 8 caracteres)", "New password (min. 8 characters)")} className="rounded-none" />
                </div>
                {newPassword ? (
                  <div className="mt-3 rounded border border-white/10 bg-slate-900/40 p-3 light:bg-slate-100/70">
                    <PasswordStrengthMeter password={newPassword} />
                  </div>
                ) : null}
                <Button className="mt-3 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={savePassword}><KeyRound className="mr-2 size-4" />{user?.hasPassword ? tr("Alterar senha", "Change password") : tr("Definir senha", "Set password")}</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="space-y-4 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{tr("Aparência e idioma", "Appearance and language")}</p>
              <div>
                <label className="text-xs text-slate-500">{tr("Perfil visual", "Visual theme")}</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["hangar", "zeon"] as const).map((option) => (
                    <button key={option} type="button" onClick={() => setFaction(option)} className={`flex items-center gap-2.5 border p-2.5 text-left transition ${faction === option ? "border-primary/60 bg-primary/10" : "border-white/15 bg-white/5 hover:border-white/30"}`}>
                      {option === "zeon" ? <FactionSigil className="size-6 shrink-0 text-primary" /> : <div className="size-6 shrink-0 border border-white/30" />}
                      <span className="text-sm capitalize">{option}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{tr("Muda a identidade visual do site (cor, cantos, tipografia). Mais facções chegam depois.", "Changes the site's look (color, corners, typography). More factions coming later.")}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">{tr("Modo de cor", "Color mode")}</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")} className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                  <option value="dark">{tr("Escuro", "Dark")}</option>
                  <option value="light">{tr("Claro", "Light")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">{tr("Texto das cartas", "Card text")}</label>
                <select value={preferredCardLanguage} onChange={(e) => setPreferredCardLanguage(e.target.value as "PT_BR" | "EN")} className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                  <option value="PT_BR">{tr("Português", "Portuguese")}</option>
                  <option value="EN">{tr("Inglês", "English")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">{tr("Idioma do site", "Site language")}</label>
                <select value={siteLang} onChange={(e) => setSiteLanguage(e.target.value === "en" ? "en" : "pt-BR")} className="field-shell mt-1.5 h-10 w-full px-3 text-sm">
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en">English</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500">{tr("Idioma padrão da interface de navegação e menus.", "Language of the menus and the rest of the interface.")}</p>
              </div>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveProfile}><Save className="mr-2 size-4" />{tr("Salvar preferências", "Save preferences")}</Button>
              {user?.username ? (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs text-slate-500">{tr("Seu perfil público:", "Your public profile:")}</p>
                  <a href={`/u/${user.username}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">
                    {window.location.origin}/u/{user.username}
                  </a>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{tr("Resumo da conta", "Account summary")}</p>
              <div className="mt-5 space-y-3">
                <div className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Email</span>
                  <span className="text-sm">{user?.email}</span>
                </div>
                <div className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{tr("Forma de acesso", "Sign-in method")}</span>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{loginMethod}</Badge>
                </div>
                <div className="panel-cut flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{tr("E-mail", "Email")}</span>
                  {user?.emailVerified ? (
                    <Badge className="rounded-none border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">{tr("Confirmado", "Confirmed")}</Badge>
                  ) : (
                    <span className="flex flex-wrap items-center gap-3">
                      <Badge className="rounded-none border border-amber-400/40 bg-amber-400/10 text-amber-300">{tr("Não confirmado", "Not confirmed")}</Badge>
                      <Button type="button" variant="outline" size="sm" disabled={resendingEmail} onClick={resendVerification} className="rounded-none text-xs">
                        {resendingEmail ? tr("Enviando...", "Sending...") : tr("Reenviar link", "Resend link")}
                      </Button>
                    </span>
                  )}
                </div>
                <div className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{tr("Usuário", "Username")}</span>
                  <span className="text-sm">@{user?.username}</span>
                </div>
                <div className="panel-cut flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{tr("Apoio Comunitário", "Community Support")}</span>
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
                      <span className="text-xs text-slate-500">{tr("Ainda não apoia", "Not a supporter yet")}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSupportModalOpen(true)}
                        className="h-7 rounded-none border-amber-400/40 bg-amber-400/10 text-xs text-amber-300 hover:bg-amber-400/20"
                      >
                        <HeartHandshake className="mr-1.5 size-3 text-amber-400" />
                        {tr("Apoiar via Pix", "Support via Pix")}
                      </Button>
                    </div>
                  )}
                </div>
                {user?.role === "ADMIN" ? (
                  <div className="panel-cut border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="size-4 text-amber-400" />
                        <span className="text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold">{tr("Credenciais de Administrador", "Administrator Access")}</span>
                      </div>
                      <Badge className="rounded-none border-amber-400/50 bg-amber-400/20 text-amber-200 text-[10px] font-mono">NÍVEL ALPHA</Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {tr("Sua conta possui acesso administrativo total. A governança de cartas, regras, usuários, torneios e CMS é operada através do Console Administrativo dedicado, separado do portal de jogador.", "Your account has full admin access. Cards, rules, users, tournaments and content are managed in the dedicated Admin Console, separate from the player portal.")}
                    </p>
                    <Button asChild size="sm" className="w-full rounded-none bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 uppercase tracking-wider text-xs">
                      <Link href="/admin">
                        <ShieldCheck className="mr-2 size-4" />
                        {tr("Abrir Console de Administração", "Open Admin Console")}
                      </Link>
                    </Button>
                  </div>
                ) : null}
                <div className="panel-cut flex items-center gap-3 border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                  <span className="text-xs leading-5 text-slate-400 dark:text-slate-400 light:text-slate-600">{tr("Sua senha nunca é armazenada em texto puro, e o login com Google não expõe sua senha do Google pra este site.", "Your password is never stored in plain text, and Google sign-in never shares your Google password with this site.")}</span>
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
