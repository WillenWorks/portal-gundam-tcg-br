/* Perfil/configurações v9 — dados pessoais + senha (ciente de login social) + avatar
 * de verdade, perfil visual + idioma do site + link público, resumo de conta. */
import { useEffect, useRef, useState } from "react";
import { KeyRound, Save, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFaction } from "@/contexts/FactionContext";
import { FactionSigil } from "@/components/theme/FactionSigil";
import { api } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ProfilePage() {
  const { user, refreshMe, setCurrentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { faction, setFaction } = useFaction();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferredCardLanguage, setPreferredCardLanguage] = useState<"PT_BR" | "EN">("PT_BR");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    if (newPassword.length < 8) { toast.error("A nova senha precisa ter pelo menos 8 caracteres."); return; }
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

  return (
    <PortalShell breadcrumbs={[{ label: "Configurações" }]}>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Dados pessoais</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Sua conta</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-400 light:text-slate-600">Nome, avatar e senha de acesso. O que já vem do seu login social (Google) não pode ser editado por aqui.</p>
              </div>

              <div className="flex items-center gap-4">
                <button type="button" onClick={handleAvatarPick} disabled={uploadingAvatar} className="group relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-slate-950/60 transition hover:border-primary/60 disabled:opacity-60">
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-heading text-2xl text-slate-500">{(user?.displayName || "?").slice(0, 1).toUpperCase()}</div>}
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
                  <option value="pt-BR">Português</option>
                  <option value="en" disabled>Inglês (em breve)</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500">Site completo em inglês ainda não está pronto — essa opção fica aqui pra quando estiver.</p>
              </div>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveProfile}><Save className="mr-2 size-4" />Salvar preferências</Button>
              <div className="border-t border-white/10 pt-4">
                <Button type="button" variant="outline" disabled className="w-full rounded-none border-white/15 bg-white/5 text-white opacity-60 light:border-slate-400/90 light:bg-white light:text-slate-950">Link público do perfil (em breve)</Button>
              </div>
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
                <div className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Usuário</span>
                  <span className="text-sm">@{user?.username}</span>
                </div>
                <div className="panel-cut flex items-center gap-3 border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                  <span className="text-xs leading-5 text-slate-400 dark:text-slate-400 light:text-slate-600">Sua senha nunca é armazenada em texto puro, e o login com Google não expõe sua senha do Google pra este site.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
