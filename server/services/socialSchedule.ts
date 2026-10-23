/* Agenda dos posts do Instagram (funções puras, sem banco).
 *
 * Padrão: segunda, quarta e sexta, post às 12:00 (horário de Brasília). O rascunho é gerado algumas horas
 * antes (SOCIAL_DRAFT_LEAD_HOURS) para dar tempo de revisar e aprovar pelo celular. Aprovado antes do
 * horário, o post espera; aprovado depois, sai na hora.
 *
 * Variáveis (todas opcionais):
 *   SOCIAL_POST_DAYS="1,3,5"      dias da semana (0 = domingo … 6 = sábado)
 *   SOCIAL_POST_TIME="12:00"      horário de publicação em Brasília
 *   SOCIAL_DRAFT_LEAD_HOURS="4"   quantas horas antes o rascunho é gerado */

export const SOCIAL_TIME_ZONE = "America/Sao_Paulo";

export type SocialScheduleConfig = {
  days: number[];
  hour: number;
  minute: number;
  leadHours: number;
};

export function readSocialScheduleConfig(env: NodeJS.ProcessEnv = process.env): SocialScheduleConfig {
  const days = String(env.SOCIAL_POST_DAYS ?? "1,3,5")
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const [h, m] = String(env.SOCIAL_POST_TIME ?? "12:00").split(":").map((v) => Number(v));
  const lead = Number(env.SOCIAL_DRAFT_LEAD_HOURS ?? "4");
  return {
    days: days.length ? [...new Set(days)].sort() : [1, 3, 5],
    hour: Number.isInteger(h) && h >= 0 && h <= 23 ? h : 12,
    minute: Number.isInteger(m) && m >= 0 && m <= 59 ? m : 0,
    leadHours: Number.isFinite(lead) && lead >= 0 && lead <= 48 ? lead : 4,
  };
}

/** Data local (Brasília) de um instante: ano, mês, dia, dia da semana e o deslocamento em minutos para UTC. */
function localParts(at: Date, timeZone = SOCIAL_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const asUtc = Date.UTC(year, month - 1, day, Number(get("hour")), Number(get("minute")), Number(get("second")));
  const offsetMinutes = Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { year, month, day, weekday, offsetMinutes };
}

/** Instante (UTC) de um horário local de Brasília num dado dia. */
function localTimeToDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const { offsetMinutes } = localParts(guess);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

export function slotKeyFor(slot: Date): string {
  const { year, month, day } = localParts(slot);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Horário de publicação de hoje (Brasília), se hoje for dia de post. */
export function todaySlot(now: Date, config: SocialScheduleConfig): Date | null {
  const { year, month, day, weekday } = localParts(now);
  if (!config.days.includes(weekday)) return null;
  return localTimeToDate(year, month, day, config.hour, config.minute);
}

/** Próximo horário de publicação a partir de agora (inclui hoje se ainda não passou). */
export function nextSlot(now: Date, config: SocialScheduleConfig): Date | null {
  if (!config.days.length) return null;
  for (let i = 0; i < 8; i += 1) {
    const probe = new Date(now.getTime() + i * 24 * 3600_000);
    const slot = todaySlot(probe, config);
    if (slot && slot.getTime() > now.getTime()) return slot;
  }
  return null;
}

/** Hoje é dia de post e já chegou a hora de gerar o rascunho? Devolve o horário de publicação (até o fim do dia). */
export function draftSlotDue(now: Date, config: SocialScheduleConfig): Date | null {
  const slot = todaySlot(now, config);
  if (!slot) return null;
  return now.getTime() >= slot.getTime() - config.leadHours * 3600_000 ? slot : null;
}

/** Formata um horário em Brasília para mensagens (ex.: "seg., 27/10 12:00"). */
export function formatSlot(slot: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SOCIAL_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(slot);
}
