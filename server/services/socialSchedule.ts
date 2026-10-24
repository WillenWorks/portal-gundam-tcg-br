/* Agenda dos posts do Instagram (funções puras, sem banco).
 *
 * Padrão: segunda, quarta e sexta, post às 12:00 (horário de Brasília). O rascunho é gerado algumas horas
 * antes (SOCIAL_DRAFT_LEAD_HOURS) para dar tempo de revisar e aprovar pelo celular. Aprovado antes do
 * horário, o post espera; aprovado depois, sai na hora.
 *
 * Cada dia tem um formato: segunda = torneios do Brasil da semana anterior, quarta = carta do dia, sexta = deck em
 * destaque.
 *
 * Variáveis (todas opcionais):
 *   SOCIAL_POST_PLAN="1:TOURNAMENT_REPORT,3:CARD_SPOTLIGHT,5:DECK_FEATURE"  dia da semana (0 = domingo … 6 = sábado) e formato
 *   SOCIAL_POST_DAYS="1,3,5"      só os dias (formato padrão de cada dia); ignorado quando há SOCIAL_POST_PLAN
 *   SOCIAL_POST_TIME="12:00"      horário de publicação em Brasília
 *   SOCIAL_DRAFT_LEAD_HOURS="4"   quantas horas antes o rascunho é gerado */

export const SOCIAL_TIME_ZONE = "America/Sao_Paulo";

export const SOCIAL_PLAN_TYPES = ["TOURNAMENT_REPORT", "CARD_SPOTLIGHT", "DECK_FEATURE"] as const;
export type SocialPlanType = (typeof SOCIAL_PLAN_TYPES)[number];
const DEFAULT_PLAN: Record<number, SocialPlanType> = { 1: "TOURNAMENT_REPORT", 3: "CARD_SPOTLIGHT", 5: "DECK_FEATURE" };

export type SocialScheduleConfig = {
  days: number[];
  /** formato do post de cada dia da agenda */
  plan: Record<number, SocialPlanType>;
  hour: number;
  minute: number;
  leadHours: number;
};

const isWeekday = (d: number) => Number.isInteger(d) && d >= 0 && d <= 6;

function readPlan(env: NodeJS.ProcessEnv): Record<number, SocialPlanType> | null {
  const raw = env.SOCIAL_POST_PLAN?.trim();
  if (!raw) return null;
  const plan: Record<number, SocialPlanType> = {};
  for (const item of raw.split(",")) {
    const [day, type] = item.split(":").map((v) => v.trim());
    const d = Number(day);
    if (isWeekday(d) && (SOCIAL_PLAN_TYPES as readonly string[]).includes(type)) plan[d] = type as SocialPlanType;
  }
  return Object.keys(plan).length ? plan : null;
}

export function readSocialScheduleConfig(env: NodeJS.ProcessEnv = process.env): SocialScheduleConfig {
  let plan = readPlan(env);
  if (!plan) {
    const days = String(env.SOCIAL_POST_DAYS ?? "1,3,5")
      .split(",")
      .map((d) => Number(d.trim()))
      .filter(isWeekday);
    plan = Object.fromEntries((days.length ? days : [1, 3, 5]).map((d) => [d, DEFAULT_PLAN[d] ?? "CARD_SPOTLIGHT"]));
  }
  const [h, m] = String(env.SOCIAL_POST_TIME ?? "12:00").split(":").map((v) => Number(v));
  const lead = Number(env.SOCIAL_DRAFT_LEAD_HOURS ?? "4");
  return {
    days: Object.keys(plan).map(Number).sort(),
    plan,
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

/** Formato do post de um horário da agenda (dia da semana em Brasília). */
export function postTypeFor(slot: Date, config: SocialScheduleConfig): SocialPlanType {
  return config.plan[localParts(slot).weekday] ?? "CARD_SPOTLIGHT";
}

/** Segunda a domingo da semana anterior ao horário (Brasília), como datas AAAA-MM-DD, para o relatório de torneios. */
export function previousWeekRange(slot: Date): { from: string; to: string } {
  const { year, month, day, weekday } = localParts(slot);
  const today = Date.UTC(year, month - 1, day);
  const daysSinceMonday = (weekday + 6) % 7;
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
  const thisMonday = today - daysSinceMonday * 24 * 3600_000;
  return { from: fmt(thisMonday - 7 * 24 * 3600_000), to: fmt(thisMonday - 24 * 3600_000) };
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
