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

type StaticSupporter = { name: string; sinceMonth?: string; message?: string };
const initialSupporters = supportersData as StaticSupporter[];

const PIX_KEY = import.meta.env.VITE_PIX_KEY || "9ca1a9a1-885f-47c6-9911-fda7e2dfe309";
const PIX_MERCHANT_NAME = import.meta.env.VITE_PIX_MERCHANT_NAME || "Willen Leolatto Carneiro";
const PIX_MERCHANT_CITY = import.meta.env.VITE_PIX_MERCHANT_CITY || "SAO PAULO";
const PIX_PAYLOAD = import.meta.env.VITE_PIX_PAYLOAD || "00020126920014BR.GOV.BCB.PIX01369ca1a9a1-885f-47c6-9911-fda7e2dfe3090230Anaheim Hub - Aquele cafezinho5204000053039865802BR5924Willen Leolatto Carneiro6009SAO PAULO62140510ZRgLn3K9h563046EEE";
const PIX_PAYMENT_URL = import.meta.env.VITE_PIX_PAYMENT_URL || "";

function PixPanel() {
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
      toast.success("Chave Pix copiada!");
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione a chave manualmente.");
    }
  };

  const copyPayload = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedPayload(true);
      toast.success("Código Pix Copia-e-Cola copiado!");
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o código Pix.");
    }
  };

  if (!PIX_KEY) {
    return (
      <div className="border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-6 text-amber-200">
        Pix ainda não configurado neste ambiente. Defina <code className="font-mono text-xs">VITE_PIX_KEY</code> (e opcionalmente{" "}
        <code className="font-mono text-xs">VITE_PIX_MERCHANT_NAME</code> / <code className="font-mono text-xs">VITE_PIX_MERCHANT_CITY</code>) no{" "}
        <code className="font-mono text-xs">.env</code> para habilitar o QR Code e a chave do Nubank.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex size-64 items-center justify-center border-2 border-white/20 bg-white p-3 shadow-lg">
        {qrDataUrl ? (
          <img loading="lazy" decoding="async" src={qrDataUrl} alt="QR Code Pix Nubank" className="h-full w-full object-contain" />
        ) : (
          <p className="text-xs text-slate-500">Gerando QR Code Pix...</p>
        )}
      </div>

      <div className="w-full space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Beneficiário Nubank</p>
          <p className="text-xs font-semibold text-white">{PIX_MERCHANT_NAME} · {PIX_MERCHANT_CITY}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Identificação: <span className="font-medium text-primary">Anaheim Hub - Aquele cafezinho</span></p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Chave Pix Direta</p>
          <div className="flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-2">
            <code className="flex-1 truncate text-left font-mono text-xs text-slate-300">{PIX_KEY}</code>
            <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-none border-white/20 hover:bg-white/10" onClick={copyKey} title="Copiar chave Pix">
              {copiedKey ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span className="ml-1.5 text-xs">{copiedKey ? "Copiado" : "Copiar Chave"}</span>
            </Button>
          </div>
        </div>

        {payload ? (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Pix Copia e Cola (Payload Bancário)</p>
            <div className="flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-2">
              <code className="flex-1 truncate text-left font-mono text-xs text-slate-400">{payload}</code>
              <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-none border-white/20 hover:bg-white/10" onClick={copyPayload} title="Copiar código Pix Copia-e-Cola">
                {copiedPayload ? <Check className="size-3.5 text-emerald-400" /> : <QrCode className="size-3.5" />}
                <span className="ml-1.5 text-xs">{copiedPayload ? "Copiado" : "Copiar Código"}</span>
              </Button>
            </div>
          </div>
        ) : null}

        {PIX_PAYMENT_URL ? (
          <div className="pt-1">
            <Button asChild variant="outline" size="sm" className="w-full rounded-none border-primary/40 bg-primary/10 text-primary hover:bg-primary/20">
              <a href={PIX_PAYMENT_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-3.5" />
                Pagar ou Doar via Link Nubank
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SupportersWall({ supporters }: { supporters: ApiSupporter[] }) {
  if (supporters.length === 0) {
    return <p className="text-sm text-slate-400">Ainda não há apoiadores listados — seja o primeiro a aparecer aqui!</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {supporters.map((supporter, idx) => (
        <div
          key={`${supporter.username || supporter.name}-${idx}`}
          title={supporter.message || (supporter.sinceMonth ? `Apoiador desde ${supporter.sinceMonth}` : "Apoiador Oficial")}
          className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-white/[0.08]"
        >
          <span className="text-xs font-medium text-slate-200">{supporter.name}</span>
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
      toast.success(res.message || "Insígnia de Apoiador ativada com sucesso! Muito obrigado pelo apoio.");
      await loadSupporters();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar confirmação de apoio.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92vh] w-[95vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl overflow-y-auto rounded-none border-white/15 bg-slate-950 p-6 sm:p-8 text-white shadow-2xl"
      >
        <DialogHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2.5 font-heading text-2xl sm:text-3xl uppercase tracking-wide">
              <HeartHandshake className="size-7 text-primary" />
              Apoie o Anaheim Hub
            </DialogTitle>
            <span className="inline-flex items-center gap-1.5 border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Pix Nubank Oficial
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            O Anaheim Hub é mantido de forma independente pela comunidade de pilotos do Gundam Card Game. Qualquer contribuição voluntária via Pix (Nubank) ajuda a cobrir os custos de infraestrutura de servidor, banco de dados, catálogo e simulador — sem transformar o projeto em assinatura paga ou poluir a tela com anúncios.
          </p>
        </DialogHeader>

        {/* Layout em 2 colunas para widescreen / telas médias para grandes */}
        <div className="grid grid-cols-1 gap-8 pt-4 lg:grid-cols-12 items-start">
          {/* Coluna 1: Painel Pix Nubank (QR Code e Chaves) */}
          <div className="lg:col-span-5 border border-white/10 bg-white/[0.02] p-5 panel-cut">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Pagamento Imediato via Pix
            </p>
            <PixPanel />
          </div>

          {/* Coluna 2: Confirmação, Insígnia e Mural de Apoiadores */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Fluxo de Ativação / Confirmação de Insígnia */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-semibold">
                Insígnia de Apoiador & Reconhecimento
              </p>

              {!isAuthenticated ? (
                /* Usuário Deslogado */
                <div className="border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-slate-300 panel-cut">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-400" />
                    <div className="space-y-2">
                      <p className="font-semibold text-white">Você está navegando como visitante (deslogado)</p>
                      <p className="text-slate-400">
                        Sua doação pelo QR Code ou chave Pix ao lado é recebida normalmente na conta Nubank de forma anônima.
                      </p>
                      <p className="text-slate-300">
                        Se você possui uma conta e quer ativar a <span className="font-semibold text-primary">Insígnia de Apoiador</span> no seu perfil e no mural de honra,{" "}
                        <Link href="/login" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                          faça login
                        </Link>{" "}
                        ou{" "}
                        <Link href="/cadastro" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                          cadastre-se
                        </Link>{" "}
                        antes ou depois de doar!
                      </p>
                    </div>
                  </div>
                </div>
              ) : user?.isSupporter ? (
                /* Usuário Logado e já Apoiador */
                <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-200 panel-cut">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-400" />
                    <div className="space-y-2.5 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">Piloto Apoiador Oficial Ativo!</p>
                        <SupporterBadge size="sm" />
                      </div>
                      <p className="text-slate-300">
                        Obrigado de coração, <span className="font-medium text-white">{user.displayName}</span>! Sua insígnia está brilhando no seu perfil e no mural comunitário.
                      </p>
                      {user.supporterSince ? (
                        <p className="text-[11px] text-slate-400">
                          Apoiando desde: {new Date(user.supporterSince).toLocaleDateString()}
                        </p>
                      ) : null}
                      <div className="pt-1">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400">Atualizar seu recado no mural:</label>
                        <div className="mt-1 flex gap-2">
                          <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ex: Força Anaheim Hub!"
                            maxLength={120}
                            className="h-8 rounded-none border-white/20 bg-slate-900 text-xs text-white"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={isConfirming}
                            onClick={handleConfirmSupport}
                            className="h-8 rounded-none border border-white/20 bg-white/10 text-xs hover:bg-white/20"
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
                <div className="border border-primary/30 bg-primary/5 p-4 text-xs leading-relaxed text-slate-300 panel-cut">
                  <div className="flex items-start gap-3">
                    <UserCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div className="w-full space-y-3">
                      <div>
                        <p className="font-semibold text-white">Confirmar Doação & Habilitar Insígnia</p>
                        <p className="mt-1 text-slate-400">
                          Após realizar o Pix pelo app do seu banco ou Nubank, confirme abaixo para ativar a{" "}
                          <span className="font-semibold text-primary">Insígnia de Apoiador</span> no seu perfil <span className="text-white">(@{user?.username})</span> e no mural.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400">Recado para o Mural (opcional):</label>
                        <Input
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Ex: Piloto de OZ apoiando a base!"
                          maxLength={120}
                          className="rounded-none border-white/20 bg-slate-900 text-xs text-white"
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
                            Ativando Insígnia...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 size-4" />
                            Já realizei o Pix! Ativar minha Insígnia de Apoiador
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-white/10" />

            {/* Mural de Apoiadores */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-semibold">Mural de Apoiadores</p>
                <span className="text-[11px] text-slate-500 font-mono">{supporters.length} piloto(s) apoiador(es)</span>
              </div>
              <SupportersWall supporters={supporters} />
            </div>

            <Separator className="bg-white/10" />

            {/* Preview da Insígnia */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-semibold">Selo Oficial no Perfil</p>
              <p className="text-xs text-slate-400">
                Apoiadores ganham este selo exibido no perfil pessoal, no perfil público e em participações comunitárias do portal:
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
