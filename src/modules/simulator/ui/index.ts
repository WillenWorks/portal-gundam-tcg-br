/* docs/19, Sessão 3 — componentes visuais do tabuleiro do simulador,
 * extraídos de `SimulatorMatchPage.tsx` (que virou só o orquestrador de
 * estado/ações). Cada um é apresentacional e prop-driven. */
export { artSrc, type ArtLookup, type CardArt, type CardFaceSize } from "./cardArt";
export { CardFace, CardBack } from "./CardFace";
export { BattleSlot, type BattleSlotActions } from "./BattleSlot";
export { DockedPilot } from "./DockedPilot";
export { ShieldStack } from "./ShieldStack";
export { ResourceTray } from "./ResourceTray";
export { BaseCardGauge } from "./BaseCardGauge";
export { BurstModal } from "./BurstModal";
export { TriggerOrderModal } from "./TriggerOrderModal";
export { CardInspectorModal } from "./CardInspectorModal";
export { CombatLane } from "./CombatLane";
export { HandDrawer } from "./HandDrawer";
export { ActionDock, type ActionDockState } from "./ActionDock";
export { useBoardElements, playerAreaKey, type BoardElements } from "./useBoardElements";
export { BattleLogDrawer } from "./BattleLogDrawer";
export { buildBattleLog, describeEvent, makeNameResolver, type BattleLogEntry, type BattleLogKind } from "./battleLog";
