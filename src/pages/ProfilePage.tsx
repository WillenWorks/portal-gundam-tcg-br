/* Perfil do usuário — edição de dados próprios, visão rápida dos decks e ponte para links públicos. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Copy, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ProfilePage() {
  const { user, isAuthenticated, login, refreshMe, setCurrentUser } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "pilot@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "pilot123" : "");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [decks, setDecks] = useState<ApiDeck[]>([]);

  const loadDecks = async () => {
    if (!isAuthenticated) return setDecks([]);
    const result = await api.listMyDecks();
    setDecks(result);
  };

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setBio(user?.bio ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user]);

  useEffect(() => {
    loadDecks().catch(() => undefined);
  }, [isAuthenticated]);

  const publicDecks = useMemo(() => decks.filter((deck) => deck.visibility === "PUBLIC"), [decks]);

  const saveProfile = async () => {
    const updated = await api.updateMe({ displayName, bio, avatarUrl });
    setCurrentUser(updated);
    await refreshMe();
    toast.success("Perfil atualizado.");
  };

  const copyPublicProfile = async () => {
    if (!user?.username) return;
    const url = `${window.location.origin}${window.location.pathname}#/u/${user.username}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link público do perfil copiado.");
  };

  return (
    <PortalShell>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Perfil e identidade</p>
              <h2 className="mt-2 font-heading text-4xl uppercase">Área do usuário integrada</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Edite nome, bio e avatar público. Os decks públicos alimentam sua vitrine e os links compartilháveis.
              </p>
            </div>

            {!isAuthenticated ? (
              <div className="panel-cut border border-white/10 bg-slate-950/60 p-5">
                <p className="text-sm leading-7 text-slate-300">Entre com uma conta de usuário para editar o perfil e validar a área pública.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                </div>
                <Button className="mt-4 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => login(email, password)}>Entrar</Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome de exibição" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="URL do avatar" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                </div>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio pública" className="min-h-32 rounded-none border-white/15 bg-slate-950/70 text-white" />
                <div className="flex flex-wrap gap-3">
                  <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveProfile}><Save className="mr-2 size-4" />Salvar perfil</Button>
                  <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={copyPublicProfile}><Copy className="mr-2 size-4" />Copiar link público</Button>
                  {user?.username ? <Link href={`/u/${user.username}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10"><ExternalLink className="mr-2 size-4" />Abrir perfil público</Link> : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Resumo público</p>
                <h3 className="mt-2 font-heading text-3xl uppercase">Decks publicados</h3>
              </div>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{publicDecks.length} públicos</Badge>
            </div>

            <div className="mt-6 space-y-3">
              {publicDecks.length ? publicDecks.map((deck) => (
                <div key={deck.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-lg text-white">{deck.name}</p>
                    <p className="text-sm text-slate-400">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · share id {deck.shareId}</p>
                  </div>
                  <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir deck</Link>
                </div>
              )) : <p className="text-sm leading-7 text-slate-400">Nenhum deck público ainda. No deckbuilder, marque a visibilidade como pública para popular esta área.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
