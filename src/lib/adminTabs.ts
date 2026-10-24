export const ADMIN_TABS = ["overview", "marketing", "social", "dynamic", "actions", "workflows", "bugs"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

/** Aba inicial do painel a partir da âncora da URL (ex.: o aviso do Discord linka /admin#social). */
export function adminTabFromHash(hash: string): AdminTab {
  const name = hash.replace(/^#/, "");
  return (ADMIN_TABS as readonly string[]).includes(name) ? (name as AdminTab) : "overview";
}
