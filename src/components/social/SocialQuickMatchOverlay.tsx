/* Orquestrador Global de Partida Rápida & Notificações Sociais (SocialQuickMatchOverlay)
 * Conecta ao Socket.io (/social.io), escuta convites e gerencia o widget do anfitrião no
 * canto inferior direito, o modal de convite do convidado e a modal de escolha de deck. */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { io as ioClient, type Socket } from "socket.io-client";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { getStoredAuth } from "@/lib/api";
import { QuickMatchHostWidget } from "./QuickMatchHostWidget";
import { QuickMatchInviteModal } from "./QuickMatchInviteModal";
import { QuickMatchDeckSelectModal } from "./QuickMatchDeckSelectModal";
import { PilotMailboxModal } from "./PilotMailboxModal";

interface SocialContextType {
  startQuickMatch: (targetUserId: string, targetUsername: string, targetDisplayName?: string) => void;
  openMailbox: (defaultRecipientUsername?: string, defaultSubject?: string) => void;
}

const SocialContext = createContext<SocialContextType | null>(null);

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) {
    throw new Error("useSocial deve ser utilizado dentro de SocialQuickMatchOverlay");
  }
  return ctx;
}

export function SocialQuickMatchOverlay({ children }: { children: React.ReactNode }) {
  const { user: currentUser, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const socketRef = useRef<Socket | null>(null);

  // Estado da Caixa do Anfitrião (Canto Inferior Direito)
  const [hostWidget, setHostWidget] = useState<{
    active: boolean;
    guestUsername: string;
    guestDisplayName?: string;
    status: "INVITING" | "DECLINED" | "EXPIRED";
    inviteId?: string;
  } | null>(null);

  // Estado do Modal de Convite Recebido (Convidado)
  const [incomingInvite, setIncomingInvite] = useState<{
    inviteId: string;
    hostUser: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  } | null>(null);

  // Estado da Modal de Escolha de Deck
  const [deckSelectSession, setDeckSelectSession] = useState<{
    quickMatchId: string;
    opponent: { id: string; username: string; displayName: string; avatarUrl?: string | null };
    opponentConfirmed: boolean;
    submitting: boolean;
    waiting: boolean;
  } | null>(null);

  // Estado da Caixa Postal (Mailbox)
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [mailboxRecipient, setMailboxRecipient] = useState<string | undefined>(undefined);
  const [mailboxSubject, setMailboxSubject] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // o token fica salvo como o JWT cru (storeAuth), não como JSON
    const { token } = getStoredAuth();
    const socket = ioClient(window.location.origin, {
      path: "/social.io",
      auth: { token: token ?? undefined },
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socketRef.current = socket;

    // Convidado recebe convite de partida rápida
    socket.on("quick_match:incoming", (data: { inviteId: string; hostUser: any }) => {
      setIncomingInvite({
        inviteId: data.inviteId,
        hostUser: data.hostUser,
      });
    });

    // Anfitrião recebe recusa do convidado
    socket.on("quick_match:declined", () => {
      setHostWidget((prev) => (prev ? { ...prev, status: "DECLINED" } : null));
      setTimeout(() => {
        setHostWidget(null);
      }, 3500);
    });

    // Convite cancelado pelo anfitrião
    socket.on("quick_match:cancelled", () => {
      setIncomingInvite(null);
    });

    // Convite expirado por timeout
    socket.on("quick_match:expired", () => {
      setIncomingInvite(null);
      setHostWidget((prev) => (prev ? { ...prev, status: "EXPIRED" } : null));
      setTimeout(() => {
        setHostWidget(null);
      }, 3500);
    });

    // Ambos entram na fase de escolha de deck
    socket.on("quick_match:launch", (data: { quickMatchId: string; hostUser: any; guestUser: any }) => {
      setHostWidget(null);
      setIncomingInvite(null);

      const isHost = data.hostUser.id === currentUser.id;
      const opponent = isHost ? data.guestUser : data.hostUser;

      setDeckSelectSession({
        quickMatchId: data.quickMatchId,
        opponent,
        opponentConfirmed: false,
        submitting: false,
        waiting: false,
      });
    });

    // Oponente confirmou deck
    socket.on("quick_match:opponent_deck_confirmed", () => {
      setDeckSelectSession((prev) => (prev ? { ...prev, opponentConfirmed: true } : null));
    });

    // Partida pronta -> Navega para o simulador
    socket.on("quick_match:ready", (data: { matchId: string }) => {
      setDeckSelectSession(null);
      toast.success("Partida iniciada! Entrando no campo de combate...");
      navigate(`/simulador/partida/${data.matchId}`);
    });

    // Erro ao resolver deck
    socket.on("quick_match:error", (data: { message: string }) => {
      toast.error(data.message || "Erro ao iniciar partida rápida.");
      setDeckSelectSession(null);
    });

    // Alerta de denúncia para Administrador
    socket.on("social:admin_report", (data: { reporterUsername: string; reportedUsername: string; reason: string }) => {
      toast.error(`🚨 ALERTA ADMIN: @${data.reporterUsername} denunciou @${data.reportedUsername}! Motivo: ${data.reason}`, {
        duration: 10000,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, currentUser?.id, navigate]);

  // Função disparada por qualquer botão do site para convidar um amigo
  const startQuickMatch = (targetUserId: string, targetUsername: string, targetDisplayName?: string) => {
    if (!socketRef.current?.connected) {
      toast.error("Conectando ao canal tático... Tente novamente em instantes.");
      return;
    }

    setHostWidget({
      active: true,
      guestUsername: targetUsername,
      guestDisplayName: targetDisplayName,
      status: "INVITING",
    });

    socketRef.current.emit(
      "quick_match:invite",
      { targetUserId },
      (res: { ok?: boolean; inviteId?: string; error?: string }) => {
        if (res?.error) {
          toast.error(res.error);
          setHostWidget(null);
        } else if (res?.inviteId) {
          setHostWidget((prev) => (prev ? { ...prev, inviteId: res.inviteId } : null));
        }
      }
    );
  };

  const handleCancelHost = () => {
    if (hostWidget?.inviteId && socketRef.current) {
      socketRef.current.emit("quick_match:cancel", { inviteId: hostWidget.inviteId });
    }
    setHostWidget(null);
  };

  const handleAcceptInvite = () => {
    if (!incomingInvite?.inviteId || !socketRef.current) return;
    socketRef.current.emit("quick_match:accept", { inviteId: incomingInvite.inviteId });
  };

  const handleDeclineInvite = () => {
    if (!incomingInvite?.inviteId || !socketRef.current) return;
    socketRef.current.emit("quick_match:decline", { inviteId: incomingInvite.inviteId });
    setIncomingInvite(null);
  };

  const handleConfirmDeck = (deckKey: string) => {
    if (!deckSelectSession?.quickMatchId || !socketRef.current) return;

    setDeckSelectSession((prev) => (prev ? { ...prev, submitting: true } : null));

    socketRef.current.emit(
      "quick_match:select_deck",
      { quickMatchId: deckSelectSession.quickMatchId, deckKey },
      (res: { ok?: boolean; error?: string }) => {
        if (res?.error) {
          toast.error(res.error);
          setDeckSelectSession((prev) => (prev ? { ...prev, submitting: false } : null));
        } else {
          setDeckSelectSession((prev) => (prev ? { ...prev, submitting: false, waiting: true } : null));
        }
      }
    );
  };

  const openMailbox = (defaultRecipientUsername?: string, defaultSubject?: string) => {
    setMailboxRecipient(defaultRecipientUsername);
    setMailboxSubject(defaultSubject);
    setMailboxOpen(true);
  };

  return (
    <SocialContext.Provider value={{ startQuickMatch, openMailbox }}>
      {children}

      {/* Caixinha do Anfitrião no Canto Inferior Direito */}
      {hostWidget?.active && (
        <QuickMatchHostWidget
          guestUsername={hostWidget.guestUsername}
          guestDisplayName={hostWidget.guestDisplayName}
          status={hostWidget.status}
          onCancel={handleCancelHost}
        />
      )}

      {/* Modal de Convite Recebido pelo Convidado */}
      <QuickMatchInviteModal
        open={Boolean(incomingInvite)}
        hostUser={incomingInvite?.hostUser}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
      />

      {/* Modal de Escolha de Deck do Simulador */}
      {deckSelectSession && (
        <QuickMatchDeckSelectModal
          open={Boolean(deckSelectSession)}
          opponentDisplayName={deckSelectSession.opponent.displayName}
          opponentUsername={deckSelectSession.opponent.username}
          opponentConfirmed={deckSelectSession.opponentConfirmed}
          submitting={deckSelectSession.submitting}
          waitingForOpponent={deckSelectSession.waiting}
          onConfirmDeck={handleConfirmDeck}
        />
      )}

      {/* Modal Global de Caixa Postal (Mensageria Assíncrona) */}
      <PilotMailboxModal
        open={mailboxOpen}
        onOpenChange={setMailboxOpen}
        defaultRecipientUsername={mailboxRecipient}
        defaultSubject={mailboxSubject}
      />
    </SocialContext.Provider>
  );
}
