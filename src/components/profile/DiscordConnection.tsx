/* Linha "Discord" do perfil: conectar a conta dá o cargo da patente de apoiador e das tags no servidor do Anaheim Hub.
 * O Discord devolve para /profile?discord=<resultado>; o aviso aparece uma vez e o parâmetro sai da barra. */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { api } from "@/lib/api";

type Props = {
  connected: boolean;
  username?: string | null;
  onChange: () => Promise<unknown> | void;
};

const RESULTS: Record<string, { ok: boolean; pt: string; en: string }> = {
  conectado: { ok: true, pt: "Discord conectado! Seus cargos no servidor aparecem em instantes.", en: "Discord connected! Your server roles show up shortly." },
  ocupado: { ok: false, pt: "Essa conta do Discord já está conectada a outra conta do site.", en: "That Discord account is already linked to another account." },
  cancelado: { ok: false, pt: "Conexão com o Discord cancelada.", en: "Discord connection cancelled." },
  expirado: { ok: false, pt: "O pedido de conexão expirou. Tente de novo.", en: "The connection request expired. Try again." },
  erro: { ok: false, pt: "Não deu para conectar o Discord agora. Tente de novo em instantes.", en: "Couldn't connect Discord right now. Try again shortly." },
};

export function DiscordConnection({ connected, username, onChange }: Props) {
  const { tr } = useSiteLanguage();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("discord");
    if (!result) return;
    const info = RESULTS[result] ?? RESULTS.erro;
    if (info.ok) toast.success(tr(info.pt, info.en));
    else toast.error(tr(info.pt, info.en));
    params.delete("discord");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    if (info.ok) void onChange();
    // só na chegada à página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api.startDiscordLink();
      if (!/^https:\/\/discord\.com\/oauth2\/authorize\?/.test(url)) throw new Error(tr("Endereço do Discord inválido.", "Invalid Discord address."));
      window.location.assign(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Não deu para conectar o Discord.", "Couldn't connect Discord."));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.disconnectDiscord();
      await onChange();
      toast.success(tr("Discord desconectado.", "Discord disconnected."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Não deu para desconectar.", "Couldn't disconnect."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-cut flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
      <div className="space-y-0.5">
        <span className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Discord</span>
        <p className="text-xs text-slate-500">
          {connected
            ? tr("Seus cargos de apoiador e tags aparecem no servidor do Anaheim Hub.", "Your supporter and tag roles show up on the Anaheim Hub server.")
            : tr("Conecte para receber no servidor o cargo da sua patente e das suas tags.", "Connect to get your tier and tag roles on the server.")}
        </p>
      </div>
      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{username ? `@${username}` : tr("Conectado", "Connected")}</span>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={disconnect} className="h-7 rounded-none text-xs">
            {tr("Desconectar", "Disconnect")}
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={connect} className="h-7 rounded-none bg-[#5865F2] text-xs text-white hover:bg-[#4752c4]">
          {busy ? tr("Abrindo o Discord…", "Opening Discord…") : tr("Conectar Discord", "Connect Discord")}
        </Button>
      )}
    </div>
  );
}
