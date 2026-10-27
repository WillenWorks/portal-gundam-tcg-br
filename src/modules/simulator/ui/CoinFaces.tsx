/* Spec simulador-cadencia-de-mesa (P1) — as duas faces da moeda do sorteio de iniciativa. Arte própria (vetor
 * simples), não logotipo oficial: de um lado um rosto estilizado de Gundam (antena em V, olhos, grade da boca), do
 * outro um emblema estilizado da Federação (globo com asas e estrela). */

export function Rx78Face({ className }: { className?: string }) {
  return (
    <svg viewBox="16 8 68 68" className={className} role="img" aria-label="RX-78">
      {/* antena em V */}
      <path d="M50 40 L20 14 L24 12 L50 33 L76 12 L80 14 Z" fill="#facc15" stroke="#a16207" strokeWidth="1.2" />
      {/* capacete */}
      <path d="M30 40 Q50 26 70 40 L72 62 Q50 72 28 62 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
      {/* crista vermelha da testa */}
      <path d="M45 33 L55 33 L53 40 L47 40 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
      {/* visor */}
      <path d="M33 45 L67 45 L65 53 L35 53 Z" fill="#0f172a" />
      {/* olhos */}
      <path d="M36 47 L47 47 L46 51 L37 51 Z" fill="#a3e635" />
      <path d="M53 47 L64 47 L63 51 L54 51 Z" fill="#a3e635" />
      {/* máscara com grade */}
      <path d="M38 55 L62 55 L58 66 L42 66 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1.2" />
      <path d="M45 57 V64 M50 57 V65 M55 57 V64" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
      {/* queixo */}
      <path d="M44 66 L56 66 L54 72 L46 72 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
      {/* bochechas */}
      <path d="M28 52 L33 50 L35 62 L30 61 Z M72 52 L67 50 L65 62 L70 61 Z" fill="#94a3b8" />
    </svg>
  );
}

export function FederationEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="4 12 92 80" className={className} role="img" aria-label="Federação">
      {/* asas */}
      <path d="M36 50 Q22 40 8 44 Q20 48 18 52 Q26 50 28 56 Q32 52 36 56 Z" fill="#e2e8f0" stroke="#1e3a8a" strokeWidth="1.2" />
      <path d="M64 50 Q78 40 92 44 Q80 48 82 52 Q74 50 72 56 Q68 52 64 56 Z" fill="#e2e8f0" stroke="#1e3a8a" strokeWidth="1.2" />
      {/* globo */}
      <circle cx="50" cy="52" r="17" fill="#1d4ed8" stroke="#e2e8f0" strokeWidth="2" />
      <ellipse cx="50" cy="52" rx="7" ry="17" fill="none" stroke="#bfdbfe" strokeWidth="1.3" />
      <path d="M33 52 H67 M36 43 H64 M36 61 H64" stroke="#bfdbfe" strokeWidth="1.3" />
      {/* estrela */}
      <path d="M50 18 L53 27 L62 27 L55 32 L58 41 L50 35.5 L42 41 L45 32 L38 27 L47 27 Z" fill="#facc15" stroke="#a16207" strokeWidth="1" />
      {/* faixa */}
      <path d="M30 74 Q50 82 70 74 L68 80 Q50 87 32 80 Z" fill="#1e3a8a" stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}
