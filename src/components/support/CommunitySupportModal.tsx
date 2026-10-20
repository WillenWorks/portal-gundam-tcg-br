/* Apoio Comunitário Imediato via Pix — QR Code Pix real (payload BR Code gerado localmente,
 * ver src/lib/pix.ts, sem depender de nenhuma API de pagamento externa), chave copia-e-cola,
 * link de pagamento Nubank opcional, confirmação de doação para ativar a Insígnia de Apoiador
 * e mural dinâmico integrado ao banco de dados e sessão.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink, HeartHandshake, Loader2, QrCode, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SupporterBadge } from "@/components/support/SupporterBadge";
import { buildPixPayload } from "@/lib/pix";
import { api, type ApiSupporter } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import supportersData from "@/data/supporters.json";
import { useSiteLanguage } from "@/i18n/siteLanguage";

type StaticSupporter = { name: string; sinceMonth?: string; message?: string };
const initialSupporters = supportersData as StaticSupporter[];

const PIX_KEY = import.meta.env.VITE_PIX_KEY || "9ca1a9a1-885f-47c6-9911-fda7e2dfe309";
const PIX_MERCHANT_NAME = import.meta.env.VITE_PIX_MERCHANT_NAME || "Willen Leolatto Carneiro";
const PIX_MERCHANT_CITY = import.meta.env.VITE_PIX_MERCHANT_CITY || "SAO PAULO";
const PIX_PAYLOAD = import.meta.env.VITE_PIX_PAYLOAD || "00020126920014BR.GOV.BCB.PIX01369ca1a9a1-885f-47c6-9911-fda7e2dfe3090230Anaheim Hub - Aquele cafezinho5204000053039865802BR5924Willen Leolatto Carneiro6009SAO PAULO62140510ZRgLn3K9h563046EEE";
const PIX_PAYMENT_URL = import.meta.env.VITE_PIX_PAYMENT_URL || "";

function PixPanel() {
  const { tr } = useSiteLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const payload = PIX_PAYLOAD || (PIX_KEY
    ? buildPixPayload({
        key: PIX_KEY,
        merchantName: PIX_MERCHANT_NAME,
        merchantCity: PIX_MERCHANT_CITY,
        description: "Anaheim Hub - Aquele cafezinho",
      })
    : null);

  useEffect(() => {
    if (!payload) return;
    QRCode.toDataURL(payload, {
      margin: 1,
      width: 260,
      color: { dark: "#0b0f19", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [payload]);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopiedKey(true);
      toast.success(tr("Chave Pix copiada!", "Pix key copied!"));
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast.error(tr("Não foi possível copiar automaticamente. Selecione a chave manualmente.", "Couldn't copy automatically. Select the key manually."));
    }
  };

  const copyPayload = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedPayload(true);
      toast.success(tr("Código Pix Copia-e-Cola copiado!", "Pix copy-and-paste code copied!"));
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      toast.error(tr("Não foi possível copiar o código Pix.", "Couldn't copy the Pix code."));
    }
  };

  if (!PIX_KEY) {
    return (
      <div className="border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-6 dark:text-amber-200 light:text-amber-800">
        Pix ainda não configurado neste ambiente. Defina <code className="font-mono text-xs">VITE_PIX_KEY</code> (e opcionalmente{" "}
        <code className="font-mono text-xs">VITE_PIX_MERCHANT_NAME</code> / <code className="font-mono text-xs">VITE_PIX_MERCHANT_CITY</code>) no{" "}
        <code className="font-mono text-xs">.env</code> para habilitar o QR Code e a chave do Nubank.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex size-64 items-center justify-center border-2 dark:border-white/20 light:border-slate-300 bg-white p-3 shadow-lg">
        {qrDataUrl ? (
          <img loading="lazy" decoding="async" src={qrDataUrl} alt="QR Code Pix Nubank" className="h-full w-full object-contain" />
        ) : (
          <p className="text-xs text-slate-500">{tr("Gerando QR Code Pix...", "Generating Pix QR code...")}</p>
        )}
      </div>

      <div className="w-full space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] dark:text-slate-400 light:text-slate-500">{tr("Beneficiário Nubank", "Recipient (Nubank)")}</p>
          <p className="text-xs font-semibold dark:text-white light:text-slate-900">{PIX_MERCHANT_NAME} · {PIX_MERCHANT_CITY}</p>
          <p className="mt-0.5 text-[11px] dark:text-slate-400 light:text-slate-600">{tr("Identificação:", "ID:")} <span className="font-medium text-primary">Anaheim Hub - Aquele cafezinho</span></p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.22em] dark:text-slate-400 light:text-slate-500">{tr("Chave Pix Direta", "Pix key")}</p>
          <div className="flex items-center gap-2 border dark:border-white/15 dark:bg-white/5 light:border-slate-300 light:bg-white px-3 py-2">
            <code className="flex-1 truncate text-left font-mono text-xs dark:text-slate-300 light:text-slate-800">{PIX_KEY}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 rounded-none dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 light:border-slate-300 light:bg-slate-100 light:text-slate-800 light:hover:bg-slate-200"
              onClick={copyKey}
              title={tr("Copiar chave Pix", "Copy Pix key")}
            >
              {copiedKey ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span className="ml-1.5 text-xs">{copiedKey ? tr("Copiado", "Copied") : "Copiar Chave"}</span>
            </Button>
          </div>
        </div>

        {payload ? (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.22em] dark:text-slate-400 light:text-slate-500">{tr("Pix Copia e Cola (Payload Bancário)", "Pix copy-and-paste code")}</p>
            <div className="flex items-center gap-2 border dark:border-white/15 dark:bg-white/5 light:border-slate-300 light:bg-white px-3 py-2">
              <code className="flex-1 truncate text-left font-mono text-xs dark:text-slate-400 light:text-slate-600">{payload}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 rounded-none dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 light:border-slate-300 light:bg-slate-100 light:text-slate-800 light:hover:bg-slate-200"
                onClick={copyPayload}
                title={tr("Copiar código Pix Copia-e-Cola", "Copy Pix code")}
              >
                {copiedPayload ? <Check className="size-3.5 text-emerald-500" /> : <QrCode className="size-3.5" />}
                <span className="ml-1.5 text-xs">{copiedPayload ? tr("Copiado", "Copied") : tr("Copiar Código", "Copy Code")}</span>
              </Button>
            </div>
          </div>
        ) : null}

        {PIX_PAYMENT_URL ? (
          <div className="pt-1">
            <Button asChild variant="outline" size="sm" className="w-full rounded-none border-primary/40 bg-primary/10 text-primary hover:bg-primary/20">
              <a href={PIX_PAYMENT_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-3.5" />
                {tr("Pagar ou Doar via Link Nubank", "Pay or donate via Nubank link")}
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SupportersWall({ supporters }: { supporters: ApiSupporter[] }) {
  const { tr } = useSiteLanguage();
  if (supporters.length === 0) {
    return <p className="text-sm dark:text-slate-400 light:text-slate-500">{tr("Ainda não há apoiadores listados — seja o primeiro a aparecer aqui!", "No supporters listed yet — be the first to show up here!")}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {supporters.map((supporter, idx) => (
        <div
          key={`${supporter.username || supporter.name}-${idx}`}
          title={supporter.message || (supporter.sinceMonth ? `Apoiador desde ${supporter.sinceMonth}` : "Apoiador Oficial")}
          className="inline-flex items-center gap-2 border dark:border-white/10 dark:bg-white/[0.04] light:border-slate-200 light:bg-slate-100/90 px-2.5 py-1.5 transition-colors hover:border-primary/40 dark:hover:bg-white/[0.08] light:hover:bg-slate-200"
        >
          <span className="text-xs font-medium dark:text-slate-200 light:text-slate-800">{supporter.name}</span>
          <SupporterBadge size="sm" />
        </div>
      ))}
    </div>
  );
}

export function CommunitySupportModal({
  open,
  onOpenChange,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const { tr, locale } = useSiteLanguage();
  const { user, isAuthenticated, setCurrentUser } = useAuth();
  const [supporters, setSupporters] = useState<ApiSupporter[]>([]);
  const [message, setMessage] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const loadSupporters = async () => {
    try {
      const dbSupporters = await api.getSupporters();
      const list = Array.isArray(dbSupporters) ? dbSupporters : [];
      // Mescla com apoiadores estáticos caso não constem ainda
      const namesInDb = new Set(list.map((s) => s.name.toLowerCase()));
      const merged: ApiSupporter[] = [...list];
      for (const st of initialSupporters) {
        if (!namesInDb.has(st.name.toLowerCase())) {
          merged.push(st);
        }
      }
      setSupporters(merged);
    } catch {
      // Fallback para estático se houver erro
      setSupporters(initialSupporters);
    }
  };

  useEffect(() => {
    if (open) {
      loadSupporters();
      if (user?.supporterMessage) {
        setMessage(user.supporterMessage);
      }
    }
  }, [open, user?.supporterMessage]);

  const handleConfirmSupport = async () => {
    if (!isAuthenticated) return;
    setIsConfirming(true);
    try {
      const res = await api.confirmSupport(message.trim() || undefined);
      setCurrentUser(res.user);
      toast.success(res.message || tr("Insígnia de Apoiador ativada com sucesso! Muito obrigado pelo apoio.", "Supporter badge activated! Thank you so much for your support."));
      await loadSupporters();
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao registrar confirmação de apoio.", "Couldn't save your support confirmation."));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92vh] w-[95vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl overflow-y-auto rounded-none dark:border-white/15 dark:bg-slate-950 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 p-6 sm:p-8 shadow-2xl"
      >
        <DialogHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2.5 font-heading text-2xl sm:text-3xl uppercase tracking-wide dark:text-white light:text-slate-950">
              <HeartHandshake className="size-7 text-primary" />
              {tr("Apoie o Anaheim Hub", "Support Anaheim Hub")}
            </DialogTitle>
            <span className="inline-flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider dark:text-emerald-300 light:text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {tr("Pix Nubank Oficial", "Official Pix (Nubank)")}
            </span>
          </div>
          <p className="text-sm leading-relaxed dark:text-slate-300 light:text-slate-600">
            O Anaheim Hub é mantido de forma independente pela comunidade de pilotos do Gundam Card Game. Qualquer contribuição voluntária via Pix (Nubank) ajuda a cobrir os custos de infraestrutura de servidor, banco de dados, catálogo e simulador — sem transformar o projeto em assinatura paga ou poluir a tela com anúncios.
          </p>
        </DialogHeader>

        {/* Layout em 2 colunas para widescreen / telas médias para grandes */}
        <div className="grid grid-cols-1 gap-8 pt-4 lg:grid-cols-12 items-start">
          {/* Coluna 1: Painel Pix Nubank (QR Code e Chaves) */}
          <div className="lg:col-span-5 border dark:border-white/10 dark:bg-white/[0.02] light:border-slate-200 light:bg-slate-50 p-5 panel-cut">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {tr("Pagamento Imediato via Pix", "Instant payment via Pix")}
            </p>
            <PixPanel />
          </div>

          {/* Coluna 2: Confirmação, Insígnia e Mural de Apoiadores */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Fluxo de Ativação / Confirmação de Insígnia */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] dark:text-slate-400 light:text-slate-500 font-semibold">
                {tr("Insígnia de Apoiador & Reconhecimento", "Supporter Badge & Recognition")}
              </p>

              {!isAuthenticated ? (
                /* Usuário Deslogado */
                <div className="border dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700 p-4 text-xs leading-relaxed panel-cut">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-500" />
                    <div className="space-y-2">
                      <p className="font-semibold dark:text-white light:text-slate-900">{tr("Você está navegando como visitante (deslogado)", "You're browsing as a guest (signed out)")}</p>
                      <p className="dark:text-slate-400 light:text-slate-600">
                        {tr("Sua doação pelo QR Code ou chave Pix ao lado é recebida normalmente na conta Nubank de forma anônima.", "Donations through the QR code or Pix key are received anonymously in the Nubank account.")}
                      </p>
                      <p className="dark:text-slate-300 light:text-slate-700">
                        {tr("Se você possui uma conta e quer ativar a", "If you have an account and want to turn on the")} <span className="font-semibold text-primary">{tr("Insígnia de Apoiador", "Supporter badge")}</span> {tr("no seu perfil e no mural de honra,", "on your profile and the honor wall,")}{" "}
                        <Link href="/login" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                          {tr("faça login", "sign in")}
                        </Link>{" "}
                        {tr("ou", "or")}{" "}
                        <Link href="/login" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                          {tr("cadastre-se", "sign up")}
                        </Link>{" "}
                        {tr("antes ou depois de doar!", "before or after donating!")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : user?.isSupporter ? (
                /* Usuário Logado e já Apoiador */
                <div className="border dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200 light:border-amber-300 light:bg-amber-50 light:text-amber-900 p-4 text-xs leading-relaxed panel-cut">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-500" />
                    <div className="space-y-2.5 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold dark:text-white light:text-amber-950">{tr("Piloto Apoiador Oficial Ativo!", "Official Supporter — active!")}</p>
                        <SupporterBadge size="sm" />
                      </div>
                      <p className="dark:text-slate-300 light:text-slate-700">
                        {tr("Obrigado de coração,", "Heartfelt thanks,")} <span className="font-medium dark:text-white light:text-slate-950">{user.displayName}</span>! {tr("Sua insígnia está brilhando no seu perfil e no mural comunitário.", "Your badge is shining on your profile and the community wall.")}
                      </p>
                      {user.supporterSince ? (
                        <p className="text-[11px] dark:text-slate-400 light:text-slate-600">
                          {tr("Apoiando desde", "Supporting since")}: {new Date(user.supporterSince).toLocaleDateString(locale)}
                        </p>
                      ) : null}
                      <div className="pt-1">
                        <label className="text-[10px] uppercase tracking-wider dark:text-slate-400 light:text-slate-600">{tr("Atualizar seu recado no mural:", "Update your message on the wall:")}</label>
                        <div className="mt-1 flex gap-2">
                          <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={tr("Ex: Força Anaheim Hub!", "e.g. Go Anaheim Hub!")}
                            maxLength={120}
                            className="h-8 rounded-none dark:border-white/20 dark:bg-slate-900 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={isConfirming}
                            onClick={handleConfirmSupport}
                            className="h-8 rounded-none border dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 light:border-slate-300 light:bg-slate-100 light:text-slate-800 light:hover:bg-slate-200 text-xs"
                          >
                            {isConfirming ? <Loader2 className="size-3.5 animate-spin" /> : "Atualizar"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Usuário Logado mas ainda não marcou como Apoiador */
                <div className="border border-primary/30 dark:bg-primary/5 dark:text-slate-300 light:border-primary/25 light:bg-primary/[0.04] light:text-slate-700 p-4 text-xs leading-relaxed panel-cut">
                  <div className="flex items-start gap-3">
                    <UserCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div className="w-full space-y-3">
                      <div>
                        <p className="font-semibold dark:text-white light:text-slate-950">{tr("Confirmar Doação & Habilitar Insígnia", "Confirm Donation & Enable Badge")}</p>
                        <p className="mt-1 dark:text-slate-400 light:text-slate-600">
                          {tr("Após realizar o Pix pelo app do seu banco ou Nubank, confirme abaixo para ativar a", "After sending the Pix from your bank app, confirm below to turn on the")}{" "}
                          <span className="font-semibold text-primary">{tr("Insígnia de Apoiador", "Supporter badge")}</span> {tr("no seu perfil", "on your profile")} <span className="dark:text-white light:text-slate-950">(@{user?.username})</span> {tr("e no mural.", "and the wall.")}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider dark:text-slate-400 light:text-slate-600">{tr("Recado para o Mural (opcional):", "Message for the wall (optional):")}</label>
                        <Input
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={tr("Ex: Piloto de OZ apoiando a base!", "e.g. OZ pilot backing the base!")}
                          maxLength={120}
                          className="rounded-none dark:border-white/20 dark:bg-slate-900 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 text-xs"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleConfirmSupport}
                        disabled={isConfirming}
                        className="w-full rounded-none bg-primary text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
                      >
                        {isConfirming ? (
                          <>
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                            {tr("Ativando Insígnia...", "Activating badge...")}
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 size-4" />
                            {tr("Já realizei o Pix! Ativar minha Insígnia de Apoiador", "I've sent the Pix! Activate my Supporter badge")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator className="dark:bg-white/10 light:bg-slate-200" />

            {/* Mural de Apoiadores */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.22em] dark:text-slate-400 light:text-slate-500 font-semibold">{tr("Mural de Apoiadores", "Supporters Wall")}</p>
                <span className="text-[11px] dark:text-slate-500 light:text-slate-500 font-mono">{supporters.length} piloto(s) apoiador(es)</span>
              </div>
              <SupportersWall supporters={supporters} />
            </div>

            <Separator className="dark:bg-white/10 light:bg-slate-200" />

            {/* Preview da Insígnia */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] dark:text-slate-400 light:text-slate-500 font-semibold">{tr("Selo Oficial no Perfil", "Official Profile Badge")}</p>
              <p className="text-xs dark:text-slate-400 light:text-slate-600">
                {tr("Apoiadores ganham este selo exibido no perfil pessoal, no perfil público e em participações comunitárias do portal:", "Supporters get this badge on their profile, public profile and community activity on the site:")}
              </p>
              <div className="pt-1">
                <SupporterBadge />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
