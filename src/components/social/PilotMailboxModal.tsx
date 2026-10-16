/* Caixa Postal do Piloto (Mensageria Assíncrona) v1
 * Conformidade com LGPD (Art. 14 / Art. 18), Marco Civil da Internet e Proteção a Menores (ECA).
 * Comunicações formais auditáveis, sem chat instantâneo não supervisionado.
 * Suporta Caixa de Entrada, Mensagens Enviadas, Redigir Mensagem e Denúncia com Alerta à Administração. */
import { useEffect, useState } from "react";
import {
  Mail,
  Send,
  Trash2,
  ShieldAlert,
  Reply,
  Inbox,
  SendHorizontal,
  PlusCircle,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { api, type PilotMailMessage } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PilotMailboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRecipientUsername?: string;
  defaultSubject?: string;
}

type MailboxTab = "inbox" | "sent" | "compose";

export function PilotMailboxModal({
  open,
  onOpenChange,
  defaultRecipientUsername,
  defaultSubject,
}: PilotMailboxModalProps) {
  const [activeTab, setActiveTab] = useState<MailboxTab>(defaultRecipientUsername ? "compose" : "inbox");
  const [inbox, setInbox] = useState<PilotMailMessage[]>([]);
  const [sent, setSent] = useState<PilotMailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMail, setSelectedMail] = useState<PilotMailMessage | null>(null);

  // Formulário de Composição
  const [recipient, setRecipient] = useState(defaultRecipientUsername || "");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  // Modal de Denúncia
  const [reportingMail, setReportingMail] = useState<PilotMailMessage | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadMails = async () => {
    setLoading(true);
    try {
      const [inboxRes, sentRes] = await Promise.all([
        api.getInboxMails().catch(() => []),
        api.getSentMails().catch(() => []),
      ]);
      setInbox(inboxRes);
      setSent(sentRes);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadMails();
      if (defaultRecipientUsername) {
        setRecipient(defaultRecipientUsername);
        setActiveTab("compose");
      }
      if (defaultSubject) {
        setSubject(defaultSubject);
      }
    } else {
      setSelectedMail(null);
      setReportingMail(null);
    }
  }, [open, defaultRecipientUsername, defaultSubject]);

  const handleOpenMail = async (mail: PilotMailMessage) => {
    try {
      const detailed = await api.getMailById(mail.id);
      setSelectedMail(detailed);
      // Atualiza o status local para lida
      setInbox((prev) => prev.map((m) => (m.id === mail.id ? { ...m, isRead: true } : m)));
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar transmissão.");
    }
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) return toast.error("Informe o piloto destinatário.");
    if (!subject.trim()) return toast.error("Informe o assunto da transmissão.");
    if (!content.trim()) return toast.error("Digite o conteúdo da mensagem.");

    setSending(true);
    try {
      const created = await api.sendMail({
        recipientUsername: recipient.trim(),
        subject: subject.trim(),
        content: content.trim(),
      });
      toast.success("Transmissão enviada com sucesso!");
      setSent((prev) => [created, ...prev]);
      setRecipient("");
      setSubject("");
      setContent("");
      setActiveTab("sent");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar transmissão.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMail = async (id: string) => {
    if (!window.confirm("Deseja apagar esta transmissão da sua caixa postal?")) return;
    try {
      await api.deleteMail(id);
      setInbox((prev) => prev.filter((m) => m.id !== id));
      setSent((prev) => prev.filter((m) => m.id !== id));
      if (selectedMail?.id === id) setSelectedMail(null);
      toast.success("Transmissão excluída.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir transmissão.");
    }
  };

  const handleReply = (mail: PilotMailMessage) => {
    const senderUsername = mail.sender?.username || "";
    setRecipient(senderUsername);
    setSubject(mail.subject.startsWith("Re: ") ? mail.subject : `Re: ${mail.subject}`);
    setContent("");
    setSelectedMail(null);
    setActiveTab("compose");
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingMail) return;
    if (!reportReason.trim()) return toast.error("Selecione ou descreva o motivo da denúncia.");

    setSubmittingReport(true);
    try {
      const res = await api.reportMail(reportingMail.id, {
        reason: reportReason.trim(),
        details: reportDetails.trim() || undefined,
      });
      toast.success(res.message || "Denúncia registrada. A administração foi notificada para providências cabíveis.");
      setReportingMail(null);
      setReportReason("");
      setReportDetails("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar denúncia.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const unreadCount = inbox.filter((m) => !m.isRead).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-2xl w-full border-white/10 bg-slate-950 p-0 text-white overflow-hidden rounded-none shadow-2xl"
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center bg-primary/10 border border-primary/30 text-primary">
                <Mail className="size-4" />
              </div>
              <div>
                <DialogTitle className="font-heading text-lg uppercase tracking-wider text-white">
                  Caixa Postal de Piloto
                </DialogTitle>
                <p className="text-[11px] text-slate-400 font-mono">
                  Transmissões Assíncronas Privadas & Seguras (LGPD Compliant)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Abas */}
          <div className="flex border-b border-white/10 bg-slate-950 text-xs font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => {
                setActiveTab("inbox");
                setSelectedMail(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 py-3 border-b-2 transition ${
                activeTab === "inbox"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Inbox className="size-3.5" />
              <span>Entrada</span>
              {unreadCount > 0 && (
                <Badge className="rounded-none bg-primary text-primary-foreground font-mono text-[9px] px-1.5 py-0">
                  {unreadCount}
                </Badge>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("sent");
                setSelectedMail(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 py-3 border-b-2 transition ${
                activeTab === "sent"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <SendHorizontal className="size-3.5" />
              <span>Enviadas ({sent.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("compose");
                setSelectedMail(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 py-3 border-b-2 transition ${
                activeTab === "compose"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <PlusCircle className="size-3.5" />
              <span>Nova Mensagem</span>
            </button>
          </div>

          {/* Conteúdo */}
          <div className="h-[420px] overflow-y-auto p-4 sm:p-5 bg-slate-950/70 font-sans text-sm">
            {/* Visualização de Mensagem Aberta */}
            {selectedMail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMail(null)}
                    className="text-xs text-slate-400 hover:text-white rounded-none h-7 px-2"
                  >
                    ← Voltar à lista
                  </Button>

                  <div className="flex items-center gap-2">
                    {/* Botão de Denúncia (Disponível em mensagens recebidas) */}
                    {activeTab === "inbox" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReportingMail(selectedMail)}
                        className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-none h-7 px-2"
                        title="Denunciar transmissão à moderação"
                      >
                        <ShieldAlert className="size-3.5 mr-1" />
                        Denunciar
                      </Button>
                    )}

                    {activeTab === "inbox" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReply(selectedMail)}
                        className="text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 rounded-none h-7 px-2"
                      >
                        <Reply className="size-3.5 mr-1" />
                        Responder
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMail(selectedMail.id)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-none h-7 px-2"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-heading text-xl uppercase tracking-wider text-white">
                    {selectedMail.subject}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div>
                      {activeTab === "inbox" ? (
                        <span>
                          De: <strong className="text-white">@{selectedMail.sender?.username}</strong>{" "}
                          ({selectedMail.sender?.displayName})
                        </span>
                      ) : (
                        <span>
                          Para: <strong className="text-white">@{selectedMail.recipient?.username}</strong>{" "}
                          ({selectedMail.recipient?.displayName})
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {new Date(selectedMail.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/60 border border-white/10 text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap min-h-36">
                  {selectedMail.content}
                </div>
              </div>
            ) : activeTab === "inbox" ? (
              /* Aba: Caixa de Entrada */
              loading ? (
                <div className="flex h-full items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Sincronizando transmissões recebidas...</span>
                </div>
              ) : inbox.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-slate-500 text-center p-6">
                  <Inbox className="size-10 mb-2 opacity-30" />
                  <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Caixa de Entrada Vazia</p>
                  <p className="text-xs text-slate-500 mt-1">Nenhuma mensagem assíncrona recebida ainda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inbox.map((mail) => (
                    <div
                      key={mail.id}
                      onClick={() => handleOpenMail(mail)}
                      className={`p-3 border border-white/10 cursor-pointer transition flex items-center justify-between gap-3 ${
                        !mail.isRead
                          ? "bg-primary/10 border-primary/40 hover:bg-primary/15"
                          : "bg-slate-900/40 hover:bg-white/5 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className="size-8 shrink-0 border border-white/10">
                          <AvatarImage src={mail.sender?.avatarUrl || undefined} />
                          <AvatarFallback className="text-[10px] bg-slate-800 text-white font-mono">
                            {mail.sender?.displayName?.slice(0, 2).toUpperCase() || "PL"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-white truncate">
                              @{mail.sender?.username}
                            </span>
                            {!mail.isRead && (
                              <Badge className="rounded-none bg-primary text-primary-foreground text-[8px] font-mono px-1 py-0 uppercase">
                                Nova
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-200 font-medium truncate">{mail.subject}</p>
                          <p className="text-[11px] text-slate-400 truncate">{mail.content}</p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {new Date(mail.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === "sent" ? (
              /* Aba: Enviadas */
              loading ? (
                <div className="flex h-full items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Sincronizando transmissões enviadas...</span>
                </div>
              ) : sent.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-slate-500 text-center p-6">
                  <SendHorizontal className="size-10 mb-2 opacity-30" />
                  <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Nenhum Envio Registrado</p>
                  <p className="text-xs text-slate-500 mt-1">Transmita uma mensagem para seus amigos vinculados.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sent.map((mail) => (
                    <div
                      key={mail.id}
                      onClick={() => handleOpenMail(mail)}
                      className="p-3 border border-white/10 bg-slate-900/40 hover:bg-white/5 cursor-pointer transition flex items-center justify-between gap-3 text-slate-300"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className="size-8 shrink-0 border border-white/10">
                          <AvatarImage src={mail.recipient?.avatarUrl || undefined} />
                          <AvatarFallback className="text-[10px] bg-slate-800 text-white font-mono">
                            {mail.recipient?.displayName?.slice(0, 2).toUpperCase() || "PL"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="overflow-hidden">
                          <span className="font-semibold text-xs text-white truncate block">
                            Para: @{mail.recipient?.username}
                          </span>
                          <p className="text-xs text-slate-200 font-medium truncate">{mail.subject}</p>
                          <p className="text-[11px] text-slate-400 truncate">{mail.content}</p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {new Date(mail.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Aba: Redigir Nova Mensagem */
              <form onSubmit={handleSendMail} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Destinatário (@username do amigo)
                  </label>
                  <Input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Ex: piloto_zeon"
                    required
                    className="rounded-none bg-slate-900/80 border-white/15 text-xs text-white"
                  />
                  <p className="text-[10px] text-slate-500 font-mono">
                    * Apenas pilotos vinculados como amigos recebem mensagens assíncronas.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Assunto
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Assunto da transmissão..."
                    maxLength={120}
                    required
                    className="rounded-none bg-slate-900/80 border-white/15 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Mensagem
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">{content.length} / 1500</span>
                  </div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escreva sua mensagem formal para o piloto..."
                    rows={6}
                    maxLength={1500}
                    required
                    className="rounded-none bg-slate-900/80 border-white/15 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={sending || !content.trim() || !subject.trim() || !recipient.trim()}
                    className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider font-semibold"
                  >
                    <Send className="size-3.5 mr-1.5" />
                    {sending ? "Transmitindo..." : "Transmitir Mensagem"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Denúncia com Notificação ao Administrador */}
      {reportingMail && (
        <Dialog open={Boolean(reportingMail)} onOpenChange={(o) => !o && setReportingMail(null)}>
          <DialogContent
            aria-describedby={undefined}
            className="sm:max-w-md w-full border-amber-500/30 bg-slate-950 p-5 text-white rounded-none shadow-2xl"
          >
            <DialogHeader>
              <DialogTitle className="font-heading text-lg uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <AlertTriangle className="size-5" /> Denunciar Mensagem à Administração
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmitReport} className="space-y-4 pt-2">
              <p className="text-xs text-slate-300 leading-relaxed">
                Ao registrar esta denúncia, a equipe administrativa do Anaheim Hub será notificada imediatamente para averiguação e aplicação das sanções legais e regulamentares (LGPD / ECA).
              </p>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Motivo da Infração
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                  className="w-full rounded-none border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="">Selecione o motivo...</option>
                  <option value="Assédio ou Cyberbullying">Assédio ou Cyberbullying</option>
                  <option value="Conteúdo Inadequado para Menores">Conteúdo Inadequado para Menores</option>
                  <option value="Linguagem Ofensiva ou Discriminação">Linguagem Ofensiva ou Discriminação</option>
                  <option value="Spam ou Divulgação Não Autorizada">Spam ou Divulgação Não Autorizada</option>
                  <option value="Outro Motivo Grave">Outro Motivo Grave</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Detalhes Adicionais (Opcional)
                </label>
                <Textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Explique o contexto para a equipe de moderação..."
                  rows={3}
                  className="rounded-none bg-slate-900 border-white/15 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReportingMail(null)}
                  className="rounded-none text-xs text-slate-400"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingReport || !reportReason}
                  className="rounded-none bg-amber-600 hover:bg-amber-700 text-white text-xs uppercase tracking-wider font-semibold"
                >
                  {submittingReport ? "Registrando..." : "Enviar Denúncia ao Admin"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
