import type { ReactNode } from "react";
import { Link } from "wouter";
import { PublicShell } from "@/components/layout/PublicShell";
import privacyPolicyHtml from "@/legal/privacy-policy.html?raw";

const CONTACT_ADMIN = "admin@anaheimhub.com";
const CONTACT_SUPPORT = "contato@anaheimhub.com";
const UPDATED = "11 de outubro de 2026";
export const PRIVACY_UPDATED = "19 de outubro de 2026";

function LegalLayout({ title, updated = UPDATED, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 text-sm leading-7 text-slate-300 md:py-14 light:text-slate-700 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:uppercase [&_h2]:text-white light:[&_h2]:text-slate-900 [&_h3]:mt-5 [&_h3]:font-heading [&_h3]:text-base [&_h3]:uppercase [&_h3]:text-primary light:[&_h3]:text-primary [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">AnaheimHub Portal</p>
        <h1 className="mt-3 font-heading text-3xl uppercase text-white md:text-4xl light:text-slate-900">{title}</h1>
        <p className="text-xs text-slate-500">Última atualização: {updated}</p>
        {children}
        <p className="mt-10 text-xs text-slate-500">
          Veja também: <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link> ·{" "}
          <Link href="/termos" className="text-primary hover:underline">Termos de Uso</Link>
        </p>
      </article>
    </PublicShell>
  );
}

export function PrivacyPage() {
  // Mesmo texto da página estática public/privacidade/index.html (a que o Google e os links diretos
  // abrem): os dois saem de src/legal/privacy-policy.html — ver scripts/sync-privacy-policy.mjs.
  return (
    <LegalLayout title="Política de Privacidade" updated={PRIVACY_UPDATED}>
      <div
        className="[&_.box]:mt-5 [&_.box]:rounded [&_.box]:border [&_.box]:border-primary/30 [&_.box]:bg-primary/5 [&_.box]:p-4 [&_.box]:text-xs [&_.box]:leading-6 [&_a]:text-primary [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: privacyPolicyHtml }}
      />
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <p>
        Bem-vindo ao <strong>AnaheimHub</strong> (<a href="https://anaheimhub.com" className="text-primary hover:underline">https://anaheimhub.com</a>). Ao acessar ou utilizar nossos serviços, você declara ter lido, compreendido e concordado expressamente com estes Termos de Uso e com nossa Política de Privacidade.
      </p>

      <h2>1. Natureza do Projeto e Isenção de Vínculo Oficial</h2>
      <p>
        O AnaheimHub é uma plataforma comunitária brasileira, independente, sem fins lucrativos e desenvolvida por fãs e jogadores para a comunidade de Gundam Card Game.
      </p>
      <p className="rounded border border-amber-400/30 bg-amber-400/5 p-4 text-xs leading-6 text-slate-300 light:border-amber-400/40 light:bg-amber-400/10 light:text-slate-800">
        <strong>Aviso de Propriedade Intelectual (Disclaimer):</strong><br />
        O AnaheimHub <strong>NÃO é afiliado, patrocinado, associado ou endossado pela BANDAI NAMCO Entertainment Inc., BANDAI CO., LTD. ou SOTSU / SUNRISE</strong>.<br />
        Gundam, Gundam Card Game, Mobile Suit Gundam e todos os nomes, ilustrações, marcas e textos de cartas associados são marcas registradas e propriedade intelectual de seus respectivos titulares de direitos autorais. Seu uso neste portal ocorre exclusivamente para fins educacionais, estatísticos, informativos e de incentivo à comunidade competitiva (uso justo / fair use comunitário).
      </p>

      <h2>2. Cadastro e Responsabilidade da Conta</h2>
      <ul>
        <li>Ao criar uma conta, você se compromete a fornecer informações verídicas e manter seus dados de acesso sob sigilo.</li>
        <li>Você é o único responsável por todas as atividades realizadas através de sua conta, seja por login tradicional ou por login social com a Conta Google.</li>
        <li>Reservamo-nos o direito de suspender ou encerrar contas utilizadas para práticas de spam, fraude, ataques cibernéticos, trapaças no simulador ou qualquer conduta que viole as leis vigentes.</li>
      </ul>

      <h2>3. Propriedade do Conteúdo Gerado pelo Usuário</h2>
      <p>
        As listas de decks, descrições táticas e comentários publicados por você permanecem sob sua titularidade autoral. Ao configurar uma lista ou pasta de coleção como pública no portal, você concede ao AnaheimHub uma licença gratuita e não exclusiva para exibir, compilar e indexar esse conteúdo dentro da plataforma para consulta da comunidade de jogadores.
      </p>

      <h2>4. Simulador de Combate e Estatísticas Táticas</h2>
      <p>
        O motor do simulador de partidas, os algoritmos de automação de regras, as traduções para a língua portuguesa e os relatórios analíticos de metagame são mantidos voluntariamente pela comunidade. Embora façamos constantes esforços de validação de regras oficiais, o sistema é disponibilizado &quot;no estado em que se encontra&quot; (<em>as-is</em>), não constituindo arbitragem oficial de torneios Bandai.
      </p>

      <h2>5. Disponibilidade e Modificações dos Serviços</h2>
      <p>
        Buscamos manter o portal acessível continuamente, mas não garantimos disponibilidade ininterrupta. Funcionalidades podem ser aprimoradas, ajustadas ou temporariamente desativadas para manutenções programadas ou atualizações de regras do jogo.
      </p>

      <h2>6. Contato</h2>
      <p>
        Em caso de dúvidas sobre estes termos, pedidos de remoção de conteúdo ou contato institucional, envie uma mensagem para{" "}
        <a href={`mailto:${CONTACT_ADMIN}`} className="text-primary hover:underline">{CONTACT_ADMIN}</a> ou{" "}
        <a href={`mailto:${CONTACT_SUPPORT}`} className="text-primary hover:underline">{CONTACT_SUPPORT}</a>.
      </p>
    </LegalLayout>
  );
}

export default PrivacyPage;
