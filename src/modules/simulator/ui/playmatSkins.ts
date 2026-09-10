/* Templates temáticos de visual do tabuleiro (Playmat Skins) v1.0
 * Permite alternar o tema do campo de batalha: Hangar Federação, Zeon, Asticassia ou Espaço Sideral. */

export type PlaymatSkinId = "hangar" | "zeon" | "asticassia" | "space";

export interface PlaymatSkin {
  id: PlaymatSkinId;
  name: string;
  description: string;
  selfClasses: string;
  oppClasses: string;
  containerClasses: string;
}

export const PLAYMAT_SKINS: Record<PlaymatSkinId, PlaymatSkin> = {
  hangar: {
    id: "hangar",
    name: "Hangar da Federação (E.F.S.F.)",
    description: "Grade de lançamento metálica com demarcações táticas industriais.",
    containerClasses: "bg-gradient-to-b from-slate-950 via-slate-900/90 to-slate-950 border-primary/25",
    selfClasses: "bg-blue-950/20 border-t border-primary/20",
    oppClasses: "bg-blue-950/10 border-b border-primary/15",
  },
  zeon: {
    id: "zeon",
    name: "Docas de Zeon",
    description: "Aço industrial pesado com iluminação carmesim e dourada.",
    containerClasses: "bg-gradient-to-b from-neutral-950 via-red-950/20 to-neutral-950 border-red-500/30",
    selfClasses: "bg-red-950/25 border-t border-red-500/25",
    oppClasses: "bg-red-950/15 border-b border-red-500/20",
  },
  asticassia: {
    id: "asticassia",
    name: "Arena Asticassia (G-Witch)",
    description: "Superfície espelhada de duelos com feixes de neon ciano e verde.",
    containerClasses: "bg-gradient-to-b from-slate-950 via-teal-950/20 to-slate-950 border-cyan-400/35",
    selfClasses: "bg-cyan-950/20 border-t border-cyan-400/30 shadow-[inset_0_0_30px_rgba(34,211,238,0.05)]",
    oppClasses: "bg-cyan-950/10 border-b border-cyan-400/20",
  },
  space: {
    id: "space",
    name: "Espaço Sideral / Debris",
    description: "Vácuo espacial com nebulosa profunda e campo estelar distante.",
    containerClasses: "bg-gradient-to-b from-black via-purple-950/15 to-black border-purple-500/25",
    selfClasses: "bg-purple-950/15 border-t border-purple-500/20",
    oppClasses: "bg-purple-950/10 border-b border-purple-500/15",
  },
};

const STORAGE_KEY = "asticassia:playmat:skin";

export function getSavedPlaymatSkin(): PlaymatSkinId {
  if (typeof window === "undefined") return "hangar";
  const saved = window.localStorage.getItem(STORAGE_KEY) as PlaymatSkinId | null;
  return saved && PLAYMAT_SKINS[saved] ? saved : "hangar";
}

export function savePlaymatSkin(skin: PlaymatSkinId) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, skin);
  }
}
