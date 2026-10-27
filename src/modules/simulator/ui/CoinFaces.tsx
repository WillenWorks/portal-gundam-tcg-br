/* Spec simulador-cadencia-de-mesa (P1, revisto) — as duas faces da moeda do sorteio na identidade do Anaheim Hub: cara
 * é o logo do site (capacete com o selo "A.H."); coroa é o monograma "A.H." no mesmo desenho do selo (círculo, letras
 * fortes, a estrela e o acento ciano do logo). */
import anaheimLogo from "@/assets/anaheim-logo-transparent.webp";

export function AnaheimLogoFace({ className }: { className?: string }) {
  return <img src={anaheimLogo} alt="Anaheim Hub" className={className} draggable={false} />;
}

export function AhMonogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="A.H.">
      {/* selo: o mesmo anel duplo do capacete do logo */}
      <circle cx="50" cy="52" r="33" fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle cx="50" cy="52" r="26.5" fill="#0b1220" stroke="#e2e8f0" strokeWidth="2" />
      {/* acento ciano do logo */}
      <path d="M24 66 A30 30 0 0 0 44 81" fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontFamily="Inter, 'Segoe UI', system-ui, sans-serif"
        fontWeight={900}
        fontSize="17"
        letterSpacing="0.5"
        fill="#f8fafc"
      >
        A.H.
      </text>
      {/* a estrela do logo */}
      <path d="M78 12 L80.6 19.4 L88 22 L80.6 24.6 L78 32 L75.4 24.6 L68 22 L75.4 19.4 Z" fill="#f8fafc" />
    </svg>
  );
}
