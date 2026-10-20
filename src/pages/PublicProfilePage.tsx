/* Perfil público — vitrine social focada em identidade do jogador, decks abertos,
 * pastas de coleção com links únicos compartilháveis e moldes de rede social. */
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  BookMarked,
  Copy,
  ExternalLink,
  Globe,
  Heart,
  Layers,
  Lock,
  Mail,
  Share2,
  Sparkles,
  Swords,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { api, type ApiDeck, type ApiBinder } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PublicShell } from "@/components/layout/PublicShell";
import { SupporterBadge } from "@/components/support/SupporterBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import defaultPilotAvatar from "@/assets/home/default_pilot_avatar.webp";

import { useSocial } from "@/components/social/SocialQuickMatchOverlay";

type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isSupporter?: boolean;
  supporterSince?: string | null;
  decks: ApiDeck[];
  binders: ApiBinder[];
};

export default function PublicProfilePage() {
  const [, params] = useRoute<{ username: string }>("/u/:username");
  const { user: currentUser, isAuthenticated } = useAuth();
  const { startQuickMatch, openMailbox } = useSocial();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"decks" | "binders">("decks");

  // Moldes de rede social (estados reais conectados ao backend)
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [friendshipStatus, setFriendshipStatus] = useState<"NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "FRIENDS">("NONE");
  const [activeFriendshipId, setActiveFriendshipId] = useState<string | undefined>(undefined);
  const [isFriendOnline, setIsFriendOnline] = useState(false);

  // Estados locais de curtida de deck no perfil
  const [deckLikes, setDeckLikes] = useState<Record<string, { liked: boolean; count: number }>>({});

  useEffect(() => {
    if (!params?.username) return;
    api
      .getPublicProfile(params.username)
      .then((data) => {
        setProfile(data);
        const initialLikes: Record<string, { liked: boolean; count: number }> = {};
        for (const d of data.decks) {
          initialLikes[d.id] = { liked: Boolean(d.hasLiked), count: d.likeCount ?? 0 };
        }
        setDeckLikes(initialLikes);
      })
      .catch((err) => setError(err.message));

    // Carrega contadores de seguidores e seguindo
    api
      .getFollowStatus(params.username)
      .then((res) => {
        setIsFollowing(res.following);
        setFollowerCount(res.followerCount);
      })
      .catch(() => {});

    // Carrega status de amizade e presença online se logado
    if (isAuthenticated) {
      api
        .getFriendshipStatus(params.username)
        .then((res) => {
          setFriendshipStatus(res.status as any);
          setActiveFriendshipId(res.friendshipId);
          setIsFriendOnline(Boolean(res.online));
        })
        .catch(() => {});
    }
  }, [params?.username, isAuthenticated]);

  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      toast.error("Entre na sua conta para seguir outros pilotos.");
      return;
    }
    if (currentUser?.username === profile?.username) {
      toast.info("Você não pode seguir seu próprio perfil.");
      return;
    }
    try {
      if (isFollowing) {
        const res = await api.unfollowUser(profile!.username);
        setIsFollowing(false);
        setFollowerCount(res.followerCount);
        toast.info(`Você deixou de seguir @${profile?.username}.`);
      } else {
        const res = await api.followUser(profile!.username);
        setIsFollowing(true);
        setFollowerCount(res.followerCount);
        toast.success(`Você agora está seguindo @${profile?.username}!`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar.");
    }
  };

  const handleFriendRequest = async () => {
    if (!isAuthenticated) {
      toast.error("Entre na sua conta para adicionar amigos.");
      return;
    }
    if (currentUser?.username === profile?.username) {
      toast.info("Este é o seu próprio perfil.");
      return;
    }
    try {
      if (friendshipStatus === "NONE") {
        const res = await api.sendFriendRequest(profile!.username);
        setFriendshipStatus(res.status as any);
        setActiveFriendshipId(res.friendshipId);
        toast.success(
          res.status === "FRIENDS"
            ? `Você e @${profile?.username} agora são amigos!`
            : `Solicitação de amizade enviada para @${profile?.username}!`
        );
      } else if (friendshipStatus === "PENDING_RECEIVED" && activeFriendshipId) {
        await api.acceptFriendRequest(activeFriendshipId);
        setFriendshipStatus("FRIENDS");
        toast.success(`Você aceitou a amizade de @${profile?.username}!`);
      } else if (friendshipStatus === "PENDING_SENT") {
        await api.removeFriend(profile!.username);
        setFriendshipStatus("NONE");
        toast.info("Solicitação de amizade cancelada.");
      } else if (friendshipStatus === "FRIENDS") {
        if (window.confirm(`Desfazer amizade com @${profile?.username}?`)) {
          await api.removeFriend(profile!.username);
          setFriendshipStatus("NONE");
          toast.info("Amizade desfeita.");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar amizade.");
    }
  };

  const handleOpenMail = () => {
    if (!isAuthenticated) {
      toast.error("Entre na sua conta para enviar mensagens.");
      return;
    }
    if (currentUser?.username === profile?.username) {
      toast.info("Você não pode enviar mensagem para si mesmo.");
      return;
    }
    if (friendshipStatus !== "FRIENDS") {
      toast.info("Apenas pilotos amigos mútuos podem trocar mensagens assíncronas.");
      return;
    }
    openMailbox(profile?.username);
  };

  const handleCopyProfileUrl = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link do perfil público copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleCopyBinderUrl = async (shareId: string) => {
    const url = `${window.location.origin}/binder/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link único da pasta copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleToggleDeckLike = async (deckId: string) => {
    if (!isAuthenticated) {
      toast.error("Faça login para curtir decks.");
      return;
    }
    try {
      const res = await api.toggleDeckLike(deckId);
      setDeckLikes((prev) => ({
        ...prev,
        [deckId]: { liked: res.liked, count: res.likeCount },
      }));
      toast.success(res.liked ? "Deck curtido!" : "Curtida removida.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao curtir deck.");
    }
  };

  const totalPublicCards = profile?.binders.reduce((acc, b) => acc + (b._count?.items ?? b.items?.length ?? 0), 0) ?? 0;
  const isSelf = currentUser?.username === profile?.username;

  return (
    <PublicShell>
      <div className="space-y-6">
        {/* Card Principal de Perfil Social */}
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-6 p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !profile ? (
              <p className="text-sm text-slate-300">Carregando perfil público...</p>
            ) : (
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  {/* Avatar do Piloto */}
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-primary/40 bg-slate-950/80 shadow-lg">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={profile.avatarUrl || defaultPilotAvatar}
                      alt={profile.displayName || "Piloto"}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400 font-mono">Dossiê de Piloto</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-heading text-4xl uppercase tracking-wider">{profile.displayName}</h2>
                      {profile.isSupporter ? <SupporterBadge size="md" /> : null}
                    </div>
                    <p className="text-sm uppercase tracking-[0.18em] text-primary font-mono font-semibold">
                      @{profile.username}
                    </p>
                    <p className="max-w-2xl text-sm leading-6 text-slate-300">
                      {profile.bio || "Piloto em serviço no Anaheim Hub sem biografia pública cadastrada."}
                    </p>

                    {/* Moldes de Rede Social: Botões de Interação */}
                    {!isSelf && (
                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleToggleFollow}
                          className={`rounded-none uppercase tracking-wider text-xs font-semibold ${
                            isFollowing
                              ? "border border-primary/60 bg-primary/20 text-primary hover:bg-primary/30"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {isFollowing ? (
                            <>
                              <UserCheck className="mr-1.5 size-3.5" />
                              Seguindo
                            </>
                          ) : (
                            <>
                              <UserPlus className="mr-1.5 size-3.5" />
                              Seguir
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleFriendRequest}
                          className={`rounded-none border text-xs uppercase tracking-wider ${
                            friendshipStatus === "FRIENDS"
                              ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                              : friendshipStatus === "PENDING_SENT"
                              ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                              : friendshipStatus === "PENDING_RECEIVED"
                              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                              : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          <Users className="mr-1.5 size-3.5" />
                          {friendshipStatus === "FRIENDS"
                            ? "Amigos"
                            : friendshipStatus === "PENDING_SENT"
                            ? "Solicitado"
                            : friendshipStatus === "PENDING_RECEIVED"
                            ? "Aceitar Amizade"
                            : "Adicionar Amigo"}
                        </Button>

                        {friendshipStatus === "FRIENDS" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (!isFriendOnline) {
                                  toast.warning(`@${profile.username} está offline no momento. O piloto precisa estar conectado para uma Partida Rápida.`);
                                  return;
                                }
                                startQuickMatch(profile.id, profile.username, profile.displayName);
                              }}
                              className={`rounded-none text-xs uppercase tracking-wider transition-all ${
                                isFriendOnline
                                  ? "border-rose-500/60 bg-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:bg-rose-500/30"
                                  : "border-white/20 bg-white/5 text-slate-400 hover:bg-white/10"
                              }`}
                              title={isFriendOnline ? "Desafiar para Partida Rápida agora!" : "Piloto offline"}
                            >
                              <Swords className={`mr-1.5 size-3.5 ${isFriendOnline ? "animate-pulse text-rose-400" : ""}`} />
                              Partida Rápida {isFriendOnline && <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-400 animate-ping" />}
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleOpenMail}
                              className="rounded-none border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-300 uppercase tracking-wider hover:bg-cyan-500/20"
                            >
                              <Mail className="mr-1.5 size-3.5" />
                              Mensagem
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleOpenMail}
                            className="rounded-none border-white/10 bg-white/5 text-xs text-slate-400 uppercase tracking-wider hover:bg-white/10 opacity-70"
                            title="Apenas amigos podem enviar mensagens"
                          >
                            <Lock className="mr-1.5 size-3.5" />
                            Mensagem
                          </Button>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleCopyProfileUrl}
                          className="rounded-none text-xs text-slate-300 hover:text-white"
                          title="Compartilhar perfil"
                        >
                          <Share2 className="mr-1.5 size-3.5" />
                          Compartilhar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Métricas do Perfil */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3 text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Decks</p>
                    <p className="mt-1 font-heading text-2xl text-accent">{profile.decks.length}</p>
                  </div>
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3 text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Pastas</p>
                    <p className="mt-1 font-heading text-2xl text-emerald-400">{profile.binders.length}</p>
                  </div>
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3 text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Cartas</p>
                    <p className="mt-1 font-heading text-2xl text-primary">{totalPublicCards}</p>
                  </div>
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3 text-center">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Seguidores</p>
                    <p className="mt-1 font-heading text-2xl text-white">{followerCount}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Barra de Navegação por Abas */}
        {profile && (
          <div className="flex border-b border-white/10 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("decks")}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold uppercase tracking-wider transition ${
                activeTab === "decks"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="size-4" />
              <span>Decks Públicos ({profile.decks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("binders")}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold uppercase tracking-wider transition ${
                activeTab === "binders"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <BookMarked className="size-4" />
              <span>Pastas & Coleção Pública ({profile.binders.length})</span>
            </button>
          </div>
        )}

        {/* Conteúdo da Aba: DECKS PÚBLICOS */}
        {profile && activeTab === "decks" && (
          <div>
            {profile.decks.length === 0 ? (
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-8 text-center text-sm text-slate-400">
                  Este piloto ainda não possui decks marcados como públicos.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {profile.decks.map((deck) => {
                  const likeInfo = deckLikes[deck.id] || { liked: Boolean(deck.hasLiked), count: deck.likeCount ?? 0 };
                  const cardCount = deck.items.reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <Card key={deck.id} className="panel-cut rounded-none surface-panel">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500 font-mono">Deck Tático</p>
                            <h3 className="mt-1 font-heading text-2xl uppercase tracking-wide text-white">{deck.name}</h3>
                          </div>
                          <Badge className="rounded-none border border-white/15 bg-white/5 text-slate-200 font-mono text-xs">
                            {cardCount} cartas
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-300 line-clamp-2">
                          {deck.notes || "Sem observações táticas públicas."}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                          <Link
                            href={`/deck/${deck.shareId}`}
                            className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950"
                          >
                            Abrir deck compartilhado
                          </Link>

                          {/* Botão Social: Curtir Deck */}
                          <button
                            type="button"
                            onClick={() => handleToggleDeckLike(deck.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-mono transition ${
                              likeInfo.liked
                                ? "border-red-500/50 bg-red-500/20 text-red-300"
                                : "border-white/15 bg-white/5 text-slate-400 hover:text-white hover:border-white/30"
                            }`}
                            title={likeInfo.liked ? "Descurtir deck" : "Curtir deck"}
                          >
                            <Heart className={`size-3.5 ${likeInfo.liked ? "fill-red-500 text-red-500" : ""}`} />
                            <span>{likeInfo.count}</span>
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Conteúdo da Aba: PASTAS DE COLEÇÃO PÚBLICAS */}
        {profile && activeTab === "binders" && (
          <div>
            {profile.binders.length === 0 ? (
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-8 text-center text-sm text-slate-400 space-y-2">
                  <BookMarked className="mx-auto size-8 text-slate-500 mb-2" />
                  <p className="font-heading text-lg uppercase text-slate-300">Nenhuma pasta pública compartilhada</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Este piloto ainda não tornou pública nenhuma pasta de cartas ou vitrine de coleção no Anaheim Hub.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {profile.binders.map((binder) => {
                  const itemCount = binder._count?.items ?? binder.items?.length ?? 0;
                  const shareUrl = `${window.location.origin}/binder/${binder.shareId}`;
                  return (
                    <Card key={binder.id} className="panel-cut rounded-none surface-panel">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs uppercase tracking-[0.22em] text-emerald-400 font-mono flex items-center gap-1">
                                <Globe className="size-3" />
                                Pasta Pública
                              </p>
                              <Badge className="rounded-none border-primary/40 bg-primary/10 text-primary text-[10px] font-mono">
                                <Sparkles className="mr-1 size-2.5" />
                                Artes Distintas
                              </Badge>
                            </div>
                            <h3 className="mt-1 font-heading text-2xl uppercase tracking-wide text-white">{binder.name}</h3>
                          </div>
                          <Badge className="rounded-none border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 font-mono text-xs">
                            {itemCount} cartas
                          </Badge>
                        </div>

                        <p className="text-sm leading-6 text-slate-300 line-clamp-2">
                          {binder.description || "Vitrine pública de cartas do piloto."}
                        </p>

                        {/* Bloco de Compartilhamento em Link Único */}
                        <div className="panel-cut border border-emerald-500/20 bg-emerald-950/20 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] uppercase font-mono text-emerald-400">
                            <span>Link Único desta Pasta:</span>
                            <button
                              type="button"
                              onClick={() => handleCopyBinderUrl(binder.shareId)}
                              className="text-white hover:underline flex items-center gap-1"
                            >
                              <Copy className="size-3" />
                              Copiar
                            </button>
                          </div>
                          <div className="bg-slate-950/80 p-1.5 border border-white/10 font-mono text-[11px] text-slate-300 truncate select-all">
                            {shareUrl}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                          <Button asChild size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider">
                            <Link href={`/binder/${binder.shareId}`}>
                              <ExternalLink className="mr-1.5 size-3.5" />
                              Abrir Fichário / Pasta
                            </Link>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyBinderUrl(binder.shareId)}
                            className="rounded-none border-white/20 bg-white/5 text-xs text-white uppercase tracking-wider hover:bg-white/10"
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            Copiar Link Único
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </PublicShell>
  );
}

