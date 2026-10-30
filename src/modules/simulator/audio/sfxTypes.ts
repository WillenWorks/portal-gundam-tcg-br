/** um arquivo do pacote (gerado por scripts/audio/build-sfx.mjs) */
export interface SfxAsset {
  /** relativo à raiz pública do site */
  src: string;
  durationMs: number;
  /** onde está o golpe/pico no arquivo — o simulador alinha este ponto ao instante da ação na tela */
  impactMs: number;
}
