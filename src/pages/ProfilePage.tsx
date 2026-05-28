/* Perfil/configurações v8 — senha, avatar, idioma das cartas e tema preferido. */
import { useEffect, useState } from "react";
import { Copy, ExternalLink, KeyRound, Save } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ProfilePage() {
  const { user, refreshMe, setCurrentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [preferredCardLanguage, setPreferredCardLanguage] = useState<"PT_BR" | "EN">("PT_BR");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [decks, setDecks] = useState<ApiDeck[]>([]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setBio(user?.bio ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
    setPreferredCardLanguage(user?.preferredCardLanguage === "EN" ? "EN" : "PT_BR");
  }, [user]);

  useEffect(() => {
    api.listMyDecks().then(setDecks).catch(() => undefined);
  }, []);

  const saveProfile = async () => {
    const updated = await api.updateMe({ displayName, bio, avatarUrl, preferredCardLanguage, preferredTheme: theme });
    setCurrentUser(updated);
    await refreshMe();
    toast.success("Configurações atualizadas.");
  };

  const savePassword = async () => {
    await api.updatePassword({ currentPassword, newPassword });
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Senha atualizada.");
  };

  const copyPublicProfile = async () => {
    if (!user?.username) return;
    const url = `${window.location.origin}${window.location.pathname}#/u/${user.username}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link público do perfil copiado.");
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Configurações" }]}>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white dark:text-white light:text-slate-900">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Configurações da conta</p>
              <h2 className="mt-2 font-heading text-4xl uppercase">Perfil, idioma e tema</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome de exibição" className="rounded-none" />
              <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="URL do avatar" className="rounded-none" />
            </div>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio pública" className="min-h-28 rounded-none" />
            <div className="grid gap-4 md:grid-cols-2">
              <select value={preferredCardLanguage} onChange={(e) => setPreferredCardLanguage(e.target.value as "PT_BR" | "EN")} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900">
                <option value="PT_BR">Textos das cartas em PT-BR</option>
                <option value="EN">Textos das cartas em EN</option>
              </select>
              <select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900">
                <option value="dark">Tema escuro</option>
                <option value="light">Tema claro</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveProfile}><Save className="mr-2 size-4" />Salvar perfil</Button>
              <Button variant="outline" className="rounded-none" onClick={copyPublicProfile}><Copy className="mr-2 size-4" />Copiar link público</Button>
              {user?.username ? <Link href={`/u/${user.username}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900"><ExternalLink className="mr-2 size-4" />Abrir perfil público</Link> : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900">
            <CardContent className="space-y-4 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Senha</p>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Senha atual" className="rounded-none" />
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha" className="rounded-none" />
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={savePassword}><KeyRound className="mr-2 size-4" />Alterar senha</Button>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Resumo público</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase">Decks publicados</h3>
                </div>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{decks.filter((deck) => deck.visibility === "PUBLIC").length} públicos</Badge>
              </div>
              <div className="mt-6 space-y-3">
                {decks.filter((deck) => deck.visibility === "PUBLIC").map((deck) => (
                  <div key={deck.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                    <div>
                      <p className="text-lg">{deck.name}</p>
                      <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas</p>
                    </div>
                    <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir deck</Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
