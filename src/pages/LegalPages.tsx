import type { ReactNode } from "react";
import { Link } from "wouter";
import { PublicShell } from "@/components/layout/PublicShell";

const CONTACT = "admin@anaheimhub.com";
const UPDATED = "11 de outubro de 2026";

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 text-sm leading-7 text-slate-300 md:py-14 light:text-slate-700 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:uppercase [&_h2]:text-white light:[&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">AnaheimHub</p>
        <h1 className="mt-3 font-heading text-3xl uppercase text-white md:text-4xl light:text-slate-900">{title}</h1>
        <p className="text-xs text-slate-500">Última atualização: {UPDATED}</p>
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
  return (
    <LegalLayout title="Política de Privacidade">
      <p>
        O AnaheimHub (anaheimhub.com) é um portal comunitário e sem vínculo oficial sobre o Gundam Card Game no Brasil. Esta política explica,
        conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018), quais dados tratamos, por que e como você pode exercer seus direitos.
      </p>

      <h2>Dados que coletamos</h2>
      <ul>
        <li><strong>Conta:</strong> e-mail, nome de exibição, nome de usuário e senha (guardada só como hash, nunca em texto).</li>
        <li><strong>Login com Google:</strong> se você escolher, recebemos do Google seu nome, e-mail confirmado, foto de perfil e um identificador da conta. Não acessamos e-mails, contatos ou arquivos do Google.</li>
        <li><strong>Conteúdo que você cria:</strong> decks, pastas de coleção, biografia, foto de perfil e preferências (idioma das cartas, tema).</li>
        <li><strong>Uso do simulador:</strong> registros técnicos de partidas e relatórios de erro que você enviar, usados para corrigir o simulador e treinar o bot.</li>
        <li><strong>Dados técnicos:</strong> endereço IP e registros de acesso do servidor, usados para segurança (por exemplo, limitar tentativas de login).</li>
      </ul>

      <h2>Resultados de torneios</h2>
      <p>
        As páginas de resultados (Veda System) mostram nome do jogador, colocação, arquétipo e decklist de torneios publicados em fontes públicas
        (como Egman Events e DigiLab), sempre com o link de origem. Se você quiser corrigir ou ocultar um resultado seu, escreva para {CONTACT}.
      </p>

      <h2>Para que usamos</h2>
      <ul>
        <li>Manter sua conta, autenticar o acesso e enviar e-mails da conta (confirmação de e-mail e recuperação de senha).</li>
        <li>Exibir o conteúdo que você escolheu tornar público (decks e pastas públicos, perfil).</li>
        <li>Melhorar o simulador, as estatísticas e a segurança do site.</li>
      </ul>
      <p>Não vendemos dados pessoais e não usamos seus dados para publicidade.</p>

      <h2>Armazenamento no navegador</h2>
      <p>
        Usamos o armazenamento local do navegador para manter você conectado e lembrar preferências (tema, rascunho de deck, som). Não usamos cookies
        de publicidade nem rastreadores de terceiros.
      </p>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li><strong>Hostinger:</strong> hospedagem do site, do banco de dados e do serviço de e-mail.</li>
        <li><strong>Google:</strong> apenas para o login com Google, quando você o utiliza.</li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir. Ao pedir a exclusão, apagamos ou anonimizamos seus dados pessoais, exceto o que a lei exigir manter. Cópias de
        segurança são substituídas em até 60 dias.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção, portabilidade ou exclusão dos seus dados, e revogar o consentimento do login com Google a
        qualquer momento (em myaccount.google.com, em "Segurança" → "Apps de terceiros"). Para isso, escreva para{" "}
        <a href={`mailto:${CONTACT}`} className="text-primary hover:underline">{CONTACT}</a>. Respondemos em até 15 dias.
      </p>

      <h2>Segurança</h2>
      <p>Usamos conexão criptografada (HTTPS), senhas com hash, links de uso único com prazo de validade e limite de tentativas de login.</p>

      <h2>Alterações</h2>
      <p>Se esta política mudar, a data no topo é atualizada. Mudanças relevantes serão avisadas no site.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <p>
        Ao usar o AnaheimHub (anaheimhub.com) você concorda com estes termos. O AnaheimHub é um projeto comunitário, gratuito e{" "}
        <strong>não é afiliado, patrocinado nem endossado pela Bandai Namco</strong>. Gundam, Gundam Card Game e os nomes, imagens e textos das
        cartas pertencem aos seus respectivos donos e são usados apenas para fins informativos e de comunidade.
      </p>

      <h2>Sua conta</h2>
      <ul>
        <li>Você é responsável por manter sua senha em segredo e pelo que for feito com a sua conta.</li>
        <li>Informe um e-mail que seja seu: ele é usado para confirmar a conta e recuperar o acesso.</li>
        <li>Podemos suspender contas usadas para abuso, spam, fraude ou que violem estes termos.</li>
      </ul>

      <h2>Conteúdo publicado por você</h2>
      <p>
        Decks, pastas, textos e imagens que você publicar continuam seus. Ao torná-los públicos, você autoriza o AnaheimHub a exibi-los no site. Não
        publique conteúdo ofensivo, ilegal ou que viole direitos de terceiros.
      </p>

      <h2>Simulador, estatísticas e regras</h2>
      <p>
        O simulador, as traduções de regras e as estatísticas são feitos pela comunidade e podem conter erros. Em caso de dúvida, valem as regras e
        os textos oficiais do jogo. Resultados do simulador e do bot não representam a força real de um deck em torneio.
      </p>

      <h2>Disponibilidade</h2>
      <p>O site é oferecido "como está". Podemos alterar, pausar ou encerrar funcionalidades a qualquer momento, sem aviso prévio.</p>

      <h2>Privacidade</h2>
      <p>
        O tratamento de dados pessoais está descrito na <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
      </p>

      <h2>Contato</h2>
      <p>
        Dúvidas, pedidos de remoção de conteúdo ou correções: <a href={`mailto:${CONTACT}`} className="text-primary hover:underline">{CONTACT}</a>.
      </p>
    </LegalLayout>
  );
}

export default PrivacyPage;
