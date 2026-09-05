/* docs/19, Sessão 3 — componentes visuais do tabuleiro do simulador,
 * extraídos de `SimulatorMatchPage.tsx` (que virou só o orquestrador de
 * estado/ações). Cada um é apresentacional e prop-driven. */
export { artSrc, cardBackUrl, isGenericArtCard, type ArtLookup, type CardArt, type CardFaceSize } from "./cardArt";
export { CardFace, CardBack } from "./CardFace";
export { BattleSlot, type BattleSlotActions } from "./BattleSlot";
export { CardCornerActions, type CornerAction } from "./CardCornerActions";
export { DockedPilot } from "./DockedPilot";
export { BaseCardGauge } from "./BaseCardGauge";
export { ShieldRail } from "./ShieldRail";
export { ResourceMeter } from "./ResourceMeter";
export { CounterChip } from "./CounterChip";
export { PileTray } from "./PileTray";
export { HandFan } from "./HandFan";
export { BurstModal } from "./BurstModal";
export { MulliganModal } from "./MulliganModal";
export { FirstPlayerReveal } from "./FirstPlayerReveal";
export { TriggerOrderModal } from "./TriggerOrderModal";
export { AbilityResolutionModal } from "./AbilityResolutionModal";
export { ZoneOverflowModal } from "./ZoneOverflowModal";
export { CardInspectorModal, type LinkedPilot } from "./CardInspectorModal";
export { CardInspectorPanel } from "./CardInspectorPanel";
export { ArenaPlaymat, type ArenaSide } from "./ArenaPlaymat";
export { RotateDevicePrompt } from "./RotateDevicePrompt";
export { CombatLane } from "./CombatLane";
export { HandDrawer } from "./HandDrawer";
export { ActionDock, type ActionDockState } from "./ActionDock";
export { GameOverOverlay } from "./GameOverOverlay";
export { gameOverReasonLabel } from "./gameOverReason";
export { MatchPrompt } from "./MatchPrompt";
export { SettingsMenu } from "./SettingsMenu";
export { useBoardElements, playerAreaKey, playerShieldKey, type BoardElements } from "./useBoardElements";
export { BattleLogDrawer } from "./BattleLogDrawer";
export { buildBattleLog, describeEvent, makeNameResolver, type BattleLogEntry, type BattleLogKind } from "./battleLog";
