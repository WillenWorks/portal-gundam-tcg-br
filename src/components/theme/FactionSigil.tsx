/* Selo geométrico ORIGINAL pro perfil visual Zeon -- hexágono com corte diagonal e
 * marca central, evocando insígnia militar de forma genérica. NÃO é o crest oficial
 * da Zeon (propriedade da Bandai/Sunrise) -- desenho próprio, sem recriar nenhuma
 * marca registrada da franquia. Usado como marca d'água discreta em painéis hero. */
export function FactionSigil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <path d="M50 4 L92 27 V73 L50 96 L8 73 V27 Z" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
      <path d="M50 4 L92 27 L50 50 L8 27 Z" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path d="M50 50 L92 27 V73 L50 96 Z" fill="currentColor" opacity="0.12" />
      <line x1="26" y1="15" x2="74" y2="85" stroke="currentColor" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}
