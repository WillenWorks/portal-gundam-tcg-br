import type { Prisma } from "@prisma/client";

// Tudo que sai em resposta pública sobre uma conta. Carregar a relação sem select traz a linha
// inteira, inclusive passwordHash, e-mail e googleId, e o res.json manda tudo adiante.
export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  isSupporter: true,
  isActive: true,
} satisfies Prisma.UserSelect;
