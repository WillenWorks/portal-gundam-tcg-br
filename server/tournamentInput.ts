/* Campos aceitos ao criar ou editar um torneio pelo painel. */
import { TournamentTier } from "@prisma/client";
import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalCount = z.number().int().min(0).max(1_000_000).nullable().optional();
const optionalDate = z.null().or(z.coerce.date()).optional();

export const tournamentCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome do evento é obrigatório.").max(200),
  organizer: optionalText(200),
  country: optionalText(100),
  city: optionalText(100),
  format: z.string().trim().min(1).max(50).optional(),
  season: optionalText(50),
  seasonId: optionalText(64),
  sourceUrl: optionalText(2000),
  participantCount: optionalCount,
  roundCount: optionalCount,
  topCutSize: optionalCount,
  tier: z.enum(TournamentTier).optional(),
  vodUrls: z.array(z.string().trim().min(1).max(2000)).max(50).optional(),
  dateStart: optionalDate,
  dateEnd: optionalDate,
});

export const tournamentUpdateSchema = tournamentCreateSchema.partial();
