/* Apoio Comunitário Imediato via Pix — QR Code Pix real (payload BR Code gerado localmente,
 * ver src/lib/pix.ts, sem depender de nenhuma API de pagamento externa), chave copia-e-cola,
 * mural de apoiadores (src/data/supporters.json — lista editada manualmente pelo time até
 * existir um fluxo de confirmação de pagamento automatizado) e preview da insígnia de perfil.
 *
 * Config vem de VITE_PIX_KEY / VITE_PIX_MERCHANT_NAME / VITE_PIX_MERCHANT_CITY (.env). Sem
 * VITE_PIX_KEY preenchida, o modal avisa que o Pix ainda não foi configurado em vez de gerar
 * um QR Code falso ou usar uma chave de exemplo.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, HeartHandshake } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SupporterBadge } from "@/components/support/SupporterBadge";
import { buildPixPayload } from "@/lib/pix";
import supportersData from "@/data/supporters.json";

type Supporter = { name: string; sinceMonth?: string; message?: string };
const supporters = supportersData as Supporter[];

const PIX_KEY = import.meta.env.VITE_PIX_KEY || "";
const PIX_MERCHANT_NAME = import.meta.env.VITE_PIX_MERCHANT_NAME || "Anaheim Hub";
const PIX_MERCHANT_CITY = import.meta.env.VITE_PIX_MERCHANT_CITY || "Sao Paulo";

function PixPanel() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const payload = PIX_KEY ? buildPixPayload({ key: PIX_KEY, merchantName: PIX_MERCHANT_NAME, merchantCity: PIX_MERCHANT_CITY, description: "Apoio Anaheim Hub" }) : null;

  useEffect(() => {
    if (!payload) return;
    QRCode.toDataURL(payload, { margin: 1, width: 260, color: { dark: "#0b0f19", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [payload]);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      toast.success("Chave Pix copiada.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não deu pra copiar automaticamente. Selecione a chave manualmente.");
    }
  };

  if (!PIX_KEY) {
    return (
      <div className="border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-6 text-amber-200">
        Pix ainda não configurado neste ambiente. Defina <code className="font-mono text-xs">VITE_PIX_KEY</code> (e opcionalmente <code className="font-mono text-xs">VITE_PIX_MERCHANT_NAME</code>/<code className="font-mono text-xs">VITE_PIX_MERCHANT_CITY</code>) no <code className="font-mono text-xs">.env</code> pra habilitar o QR Code e a chave copia-e-cola.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-64 items-center justify-center border border-white/10 bg-white p-3">
        {qrDataUrl ? <img src={qrDataUrl} alt="QR Code Pix" className="h-full w-full object-contain" /> : <p className="text-xs text-slate-500">Gerando QR Code...</p>}
      </div>
      <div className="w-full space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Pix copia e cola</p>
        <div className="flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-2">
          <code className="flex-1 truncate text-left font-mono text-xs text-slate-300">{PIX_KEY}</code>
          <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-none" onClick={copyKey}>
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SupportersWall() {
  if (supporters.length === 0) {
    return <p className="text-sm text-slate-400">Ainda não há apoiadores listados — seja o primeiro a aparecer aqui.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {supporters.map((supporter) => (
        <div key={supporter.name} title={supporter.message} className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
          <span className="text-xs text-slate-200">{supporter.name}</span>
          <SupporterBadge size="sm" />
        </div>
      ))}
    </div>
  );
}

export function CommunitySupportModal({ open, onOpenChange, trigger }: { open?: boolean; onOpenChange?: (open: boolean) => void; trigger?: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent aria-describedby={undefined} className="max-h-[90vh] w-[min(92vw,640px)] overflow-y-auto rounded-none border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-2xl uppercase tracking-wide">
            <HeartHandshake className="size-5 text-primary" />Apoie o Anaheim Hub
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-7 text-slate-300">
          O Anaheim Hub é mantido pela comunidade. Qualquer valor via Pix ajuda a manter o servidor, o catálogo e o simulador no ar — sem esse apoio virar assinatura ou anúncio.
        </p>

        <PixPanel />

        <Separator className="bg-white/10" />

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Mural de apoiadores</p>
          <SupportersWall />
        </div>

        <Separator className="bg-white/10" />

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Insígnia de perfil</p>
          <p className="text-sm leading-6 text-slate-400">Quem apoia ganha este selo ao lado do nome no perfil e no mural acima.</p>
          <SupporterBadge />
        </div>
      </DialogContent>
    </Dialog>
  );
}
