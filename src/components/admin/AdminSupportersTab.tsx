/* Aba "Apoiadores" do painel admin (server/routes/supporterRoutes.ts):
 * - pedidos de "já apoiei" para conferir no Apoia.se/Pix e aprovar com patente;
 * - apoiadores ativos e contas com tags: patente, tags (várias por conta) e revogação;
 * - busca de qualquer conta para dar tags;
 * - nomes no mural de quem apoia pelo Apoia.se sem conta no site. */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, HeartHandshake, Loader2, Search, Trash2, UserPlus, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, type AdminSupporterUser, type AdminSupportersOverview, type SupporterWallEntry } from "@/lib/api";
import { SUPPORTER_TIERS, USER_TAGS, supporterTierInfo } from "@/lib/supporters";
import { SupporterBadge } from "@/components/support/SupporterBadge";
import { UserTagChips } from "@/components/support/UserTagChips";

const panel = "panel-cut rounded-none surface-panel border-white/10";
const selectCls = "h-9 rounded-none border border-white/15 bg-slate-950 px-2 text-xs text-white light:border-slate-300 light:bg-white light:text-slate-900";
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

function TierSelect({ value, onChange, label }: { value: string | null; onChange: (tier: string | null) => void; label: string }) {
  return (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={selectCls}>
      <option value="">Sem patente</option>
      {SUPPORTER_TIERS.map((t) => (
        <option key={t.key} value={t.key}>
          {t.icon} {t.label} (R$ {t.minMonthly}+)
        </option>
      ))}
    </select>
  );
}

/** Editor de uma conta: apoiador sim/não, patente e tags. Salva tudo de uma vez. */
function UserEditor({ entry, onSaved }: { entry: AdminSupporterUser; onSaved: (u: AdminSupporterUser) => void }) {
  const [isSupporter, setIsSupporter] = useState(entry.isSupporter);
  const [tier, setTier] = useState<string | null>(entry.supporterTier);
  const [tags, setTags] = useState<string[]>(entry.tags);
  const [saving, setSaving] = useState(false);
  const dirty = isSupporter !== entry.isSupporter || tier !== entry.supporterTier || tags.join() !== entry.tags.join();

  const toggleTag = (key: string) => setTags((cur) => (cur.includes(key) ? cur.filter((t) => t !== key) : [...cur, key]));
  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateAdminSupporterUser(entry.id, { isSupporter, tier: isSupporter ? tier : null, tags });
      onSaved(updated);
      toast.success(`@${entry.username} atualizado.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border border-white/10 p-4 light:border-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{entry.displayName}</p>
        <span className="text-xs text-slate-500">@{entry.username} · {entry.email}</span>
        {entry.isSupporter ? <SupporterBadge size="sm" tier={entry.supporterTier} /> : null}
        <UserTagChips tags={entry.tags} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isSupporter} onChange={(e) => setIsSupporter(e.target.checked)} />
          Apoiador {entry.supporterSince ? <span className="text-slate-500">(desde {date(entry.supporterSince)})</span> : null}
        </label>
        {isSupporter ? <TierSelect value={tier} onChange={setTier} label={`Patente de @${entry.username}`} /> : null}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Tags de @${entry.username}`}>
        {USER_TAGS.map((t) => {
          const on = tags.includes(t.key);
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleTag(t.key)}
              className={`h-7 border px-2 font-mono text-[10px] uppercase tracking-[0.12em] ${on ? "border-primary bg-primary/15 text-primary" : "border-white/15 text-slate-400 light:border-slate-300 light:text-slate-500"}`}
            >
              {on ? "✓ " : ""}
              {t.label}
            </button>
          );
        })}
      </div>
      <Button type="button" size="sm" disabled={!dirty || saving} onClick={save} className="rounded-none">
        {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
        Salvar
      </Button>
    </div>
  );
}

function ClaimRow({ entry, onDone }: { entry: AdminSupporterUser; onDone: () => void }) {
  const [tier, setTier] = useState<string | null>("RECRUTA");
  const [busy, setBusy] = useState(false);
  const act = async (body: Parameters<typeof api.updateAdminSupporterUser>[1], ok: string) => {
    setBusy(true);
    try {
      await api.updateAdminSupporterUser(entry.id, body);
      toast.success(ok);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 border border-amber-400/30 bg-amber-400/5 p-4">
      <div className="min-w-[200px] flex-1">
        <p className="font-medium">
          {entry.displayName} <span className="text-xs text-slate-500">@{entry.username} · {entry.email}</span>
        </p>
        <p className="text-xs text-slate-400">Pediu em {date(entry.supporterClaimedAt)}{entry.supporterMessage ? ` · recado: “${entry.supporterMessage}”` : ""}</p>
      </div>
      <TierSelect value={tier} onChange={setTier} label={`Patente para @${entry.username}`} />
      <Button type="button" size="sm" disabled={busy} className="rounded-none" onClick={() => act({ isSupporter: true, tier }, `@${entry.username} agora é apoiador.`)}>
        <Check className="mr-1.5 size-3.5" />
        Aprovar
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} className="rounded-none" onClick={() => act({ claim: "reject" }, "Pedido descartado.")}>
        <X className="mr-1.5 size-3.5" />
        Recusar
      </Button>
    </div>
  );
}

function WallManager({ wall, onChanged }: { wall: SupporterWallEntry[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState<string | null>("RECRUTA");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void run(async () => {
            await api.createSupporterWallEntry({ displayName: name.trim(), tier, message: message.trim() || undefined });
            setName("");
            setMessage("");
          }, "Nome adicionado ao mural.");
        }}
      >
        <Input aria-label="Nome no mural" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome como aparece no Apoia.se" maxLength={60} className="h-9 w-56 rounded-none text-xs" />
        <TierSelect value={tier} onChange={setTier} label="Patente no mural" />
        <Input aria-label="Recado" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Recado (opcional)" maxLength={200} className="h-9 w-56 rounded-none text-xs" />
        <Button type="submit" size="sm" disabled={busy || !name.trim()} className="rounded-none">
          <UserPlus className="mr-1.5 size-3.5" />
          Adicionar
        </Button>
      </form>
      {wall.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum nome sem conta no mural.</p>
      ) : (
        <ul className="divide-y divide-white/10 border border-white/10 light:divide-slate-200 light:border-slate-200">
          {wall.map((w) => (
            <li key={w.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${w.isActive ? "" : "opacity-50"}`}>
              <span className="font-medium">{w.displayName}</span>
              <SupporterBadge size="sm" tier={w.tier} />
              {w.message ? <span className="text-xs text-slate-400">“{w.message}”</span> : null}
              <span className="text-xs text-slate-500">desde {date(w.since)}</span>
              <span className="ml-auto flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busy} className="h-7 rounded-none text-xs" onClick={() => void run(() => api.updateSupporterWallEntry(w.id, { isActive: !w.isActive }), w.isActive ? "Oculto do mural." : "De volta ao mural.")}>
                  {w.isActive ? "Ocultar" : "Mostrar"}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} aria-label={`Remover ${w.displayName}`} className="h-7 rounded-none text-xs" onClick={() => void run(() => api.deleteSupporterWallEntry(w.id), "Removido do mural.")}>
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminSupportersTab() {
  const [data, setData] = useState<AdminSupportersOverview | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSupporterUser[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.getAdminSupporters());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os apoiadores.");
    }
  }, []);
  useEffect(() => {
    let alive = true;
    api
      .getAdminSupporters()
      .then((overview) => alive && setData(overview))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar os apoiadores."));
    return () => {
      alive = false;
    };
  }, []);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setResults(await api.searchAdminSupporterUsers(query.trim()));
    } finally {
      setSearching(false);
    }
  };
  const replaceResult = (u: AdminSupporterUser) => {
    setResults((cur) => cur.map((r) => (r.id === u.id ? u : r)));
    void load();
  };

  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="size-4 animate-spin" /> Carregando apoiadores…
      </p>
    );
  }

  const monthly = data.supporters.reduce((sum, u) => sum + (supporterTierInfo(u.supporterTier)?.minMonthly ?? 0), 0) +
    data.wall.filter((w) => w.isActive).reduce((sum, w) => sum + (supporterTierInfo(w.tier)?.minMonthly ?? 0), 0);

  return (
    <div className="space-y-6">
      <Card className={panel}>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <HeartHandshake className="size-8 text-primary" />
          <div className="flex-1">
            <h2 className="font-heading text-xl uppercase">Apoiadores e tags</h2>
            <p className="text-xs text-slate-400">
              Confira os pedidos no Apoia.se ou no Pix antes de aprovar. O selo e o mural mudam na hora; tags valem para qualquer conta.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge className="rounded-none border border-amber-400/40 bg-amber-400/10 text-amber-300">{data.claims.length} pedido(s)</Badge>
            <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{data.supporters.length + data.wall.filter((w) => w.isActive).length} no mural</Badge>
            <Badge className="rounded-none border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">≥ R$ {monthly}/mês pelas patentes</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className={panel}>
        <CardContent className="space-y-3 p-6">
          <h3 className="font-heading text-base uppercase">Pedidos para conferir</h3>
          {data.claims.length === 0 ? <p className="text-xs text-slate-500">Nenhum pedido pendente.</p> : data.claims.map((c) => <ClaimRow key={c.id} entry={c} onDone={() => void load()} />)}
        </CardContent>
      </Card>

      <Card className={panel}>
        <CardContent className="space-y-3 p-6">
          <h3 className="font-heading text-base uppercase">Apoiadores com conta</h3>
          {data.supporters.length === 0 ? <p className="text-xs text-slate-500">Nenhum apoiador com conta ainda.</p> : data.supporters.map((u) => <UserEditor key={`${u.id}-${u.supporterTier}-${u.tags.join()}`} entry={u} onSaved={() => void load()} />)}
        </CardContent>
      </Card>

      <Card className={panel}>
        <CardContent className="space-y-3 p-6">
          <h3 className="font-heading text-base uppercase">Dar patente ou tags a uma conta</h3>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <Input aria-label="Buscar conta" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, @usuário ou e-mail" className="h-9 max-w-sm rounded-none text-xs" />
            <Button type="submit" size="sm" disabled={searching || query.trim().length < 2} className="rounded-none">
              {searching ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Search className="mr-1.5 size-3.5" />}
              Buscar
            </Button>
          </form>
          {results.map((u) => <UserEditor key={`${u.id}-${u.isSupporter}-${u.supporterTier}-${u.tags.join()}`} entry={u} onSaved={replaceResult} />)}
          {data.tagged.length ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Contas com tags</p>
              {data.tagged.map((u) => <UserEditor key={`${u.id}-${u.tags.join()}`} entry={u} onSaved={() => void load()} />)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={panel}>
        <CardContent className="space-y-3 p-6">
          <h3 className="font-heading text-base uppercase">Mural: quem apoia sem conta no site</h3>
          <p className="text-xs text-slate-400">Para apoiadores do Apoia.se que não têm login aqui. Aparecem em /apoie junto com as contas.</p>
          <WallManager wall={data.wall} onChanged={() => void load()} />
        </CardContent>
      </Card>
    </div>
  );
}
