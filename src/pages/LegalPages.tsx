import type { ReactNode } from "react";
import { Link } from "wouter";
import { PublicShell } from "@/components/layout/PublicShell";

const CONTACT_ADMIN = "admin@anaheimhub.com";
const CONTACT_SUPPORT = "contato@anaheimhub.com";
const UPDATED = "11 de outubro de 2026";

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 text-sm leading-7 text-slate-300 md:py-14 light:text-slate-700 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:uppercase [&_h2]:text-white light:[&_h2]:text-slate-900 [&_h3]:mt-5 [&_h3]:font-heading [&_h3]:text-base [&_h3]:uppercase [&_h3]:text-primary light:[&_h3]:text-primary [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">AnaheimHub Portal</p>
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
        O <strong>AnaheimHub</strong> (disponível em <a href="https://anaheimhub.com" className="text-primary hover:underline">https://anaheimhub.com</a>), também denominado <strong>AnaheimHub Portal</strong>, é uma plataforma comunitária independente dedicada ao Gundam Card Game no Brasil. Esta Política de Privacidade descreve de forma clara e transparente como coletamos, utilizamos, armazenamos, tratamos e protegemos seus dados pessoais, em estrita conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD, Lei nº 13.709/2018)</strong> e com a <strong>Política de Dados do Usuário dos Serviços de API do Google (Google API Services User Data Policy)</strong>.
      </p>

      <h2>1. Dados que Coletamos</h2>
      <ul>
        <li><strong>Dados de Cadastro Direto:</strong> e-mail, nome de exibição, nome de usuário (handle) e senha criptografada (armazenada exclusivamente como hash irreversível via algoritmo bcrypt, nunca em texto puro).</li>
        <li><strong>Dados de Autenticação Social via Google:</strong> caso opte pelo login com a Conta Google, recebemos exclusivamente os dados autorizados nos escopos básicos (openid, profile, email): nome completo, endereço de e-mail verificado, URL da foto de perfil pública e o identificador único numérico da conta Google (Google Subject ID). <em>Não temos acesso a e-mails do Gmail, mensagens, contatos, arquivos do Google Drive ou senhas da sua Conta Google.</em></li>
        <li><strong>Conteúdo Criado pelo Usuário:</strong> listas de decks, pastas de coleção virtual, biografia de piloto, preferências de interface (idioma preferido das cartas, tema visual claro/escuro) e seleções de facção.</li>
        <li><strong>Dados de Partidas e Telemetria do Simulador:</strong> registros técnicos de jogadas em partidas contra bots ou modo arena, relatórios de erros voluntários (bug reports) com o estado da mesa congelado, utilizados exclusivamente para aprimoramento das regras do simulador e calibração das redes neurais de treino.</li>
        <li><strong>Dados Técnicos e de Segurança:</strong> endereço IP, registros de cabeçalho e logs de acesso ao servidor web para auditoria de segurança, prevenção contra ataques distribuídos (DDoS), proteção anti-bot via reCAPTCHA Enterprise e limitação de tentativas de autenticação (rate-limiting).</li>
      </ul>

      <h2>2. Integração e Uso de Dados da Conta Google (Google User Data Policy)</h2>
      <p>
        O AnaheimHub oferece a opção de autenticação simplificada através do serviço <em>Google Identity Services (Sign in with Google)</em>. O tratamento das informações obtidas por este mecanismo segue regras estritas:
      </p>
      <ul>
        <li><strong>Finalidade Exclusiva:</strong> as informações fornecidas pelo Google são utilizadas unicamente para identificar o usuário, efetuar o login com segurança (Single Sign-On), evitar contas duplicadas vinculando ao e-mail já existente e exibir seu nome e foto de perfil no painel do piloto.</li>
        <li><strong>Não Compartilhamento e Não Comercialização:</strong> o AnaheimHub <strong>NÃO vende, NÃO aluga, NÃO comercializa e NÃO transfere</strong> os dados de usuários recebidos das APIs do Google para terceiros, anunciantes, corretores de dados (data brokers) ou sistemas externos.</li>
        <li><strong>Sem Treinamento de Modelos Generalistas de IA:</strong> os dados da sua Conta Google não são utilizados para treinar modelos de inteligência artificial ou ferramentas de terceiros.</li>
        <li><strong>Armazenamento Seguro:</strong> os dados recebidos são armazenados no banco de dados seguro da aplicação com acesso restrito e conexões encriptadas via SSL/TLS.</li>
      </ul>
      <p className="rounded border border-primary/30 bg-primary/5 p-4 text-xs leading-6 text-slate-300 light:border-primary/40 light:bg-primary/10 light:text-slate-800">
        <strong>Conformidade com a Política de Uso Limitado do Google (Limited Use Disclosure):</strong><br />
        O uso e a transferência pelo AnaheimHub para qualquer outro aplicativo de informações recebidas das APIs do Google obedecerão integralmente à{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-primary underline">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>, incluindo os requisitos de Uso Limitado (Limited Use requirements).<br />
        <span className="italic text-slate-400">
          (AnaheimHub&apos;s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.)
        </span>
      </p>

      <h2>3. Resultados Públicos de Torneios (Sistema VEDA)</h2>
      <p>
        O portal compila relatórios históricos e dados estatísticos de torneios competitivos coletados de fontes públicas oficiais da comunidade (como Egman Events e DigiLab), exibindo nome do jogador, colocação, arquétipo e lista de cartas utilizada, sempre citando a proveniência original. Jogadores que desejarem retificar ou solicitar a anonimização de sua participação em listas públicas podem entrar em contato a qualquer momento.
      </p>

      <h2>4. Finalidades do Tratamento de Dados</h2>
      <p>Tratamos seus dados pessoais apenas para finalidades legítimas e transparentes:</p>
      <ul>
        <li>Autenticar o acesso e gerenciar a sessão do usuário com segurança;</li>
        <li>Disparar e-mails transacionais essenciais (confirmação de titularidade da conta e recuperação de senha esquecida);</li>
        <li>Permitir a criação, salvamento e exportação de decks e coleções de cartas;</li>
        <li>Proteger a plataforma contra tentativas de invasão, automação maliciosa e abusos;</li>
        <li>Apresentar métricas estatísticas de metagame em nível agregado e anônimo.</li>
      </ul>

      <h2>5. Cookies e Armazenamento Local</h2>
      <p>
        O AnaheimHub <strong>não utiliza cookies de rastreamento de terceiros nem pixels de publicidade comportamental</strong>. Utilizamos apenas o armazenamento local do navegador (<code>localStorage</code>) estritamente necessário para manter a sessão autenticada (token JWT), salvar preferências de exibição (tema visual, idioma das cartas) e rascunhos temporários de construção de decks.
      </p>

      <h2>6. Compartilhamento com Prestadores de Serviços</h2>
      <p>Compartilhamos dados exclusivamente com provedores essenciais para o funcionamento da infraestrutura:</p>
      <ul>
        <li><strong>Hostinger International Ltd.:</strong> infraestrutura de servidores virtuais dedicados (VPS), banco de dados PostgreSQL e serviço de transporte SMTP para envio de e-mails transacionais.</li>
        <li><strong>Google LLC:</strong> fornecimento dos serviços de autenticação (OAuth 2.0 Identity Services) e verificação de integridade contra tráfego automatizado abusivo (reCAPTCHA Enterprise).</li>
      </ul>

      <h2>7. Retenção e Exclusão de Dados</h2>
      <p>
        Seus dados pessoais permanecem armazenados enquanto a sua conta estiver ativa na plataforma. O usuário tem o direito de solicitar a exclusão definitiva ou a anonimização de seus dados a qualquer momento. Cópias de segurança residuais em backups de desastre são substituídas e purgadas em até 60 dias.
      </p>

      <h2>8. Seus Direitos (LGPD e Revogação Google)</h2>
      <p>Em conformidade com o Art. 18 da LGPD, você pode exercer a qualquer momento seus direitos de confirmação de tratamento, acesso, correção de dados incompletos ou inexatos, anonimização, bloqueio ou eliminação de dados desnecessários.</p>
      <p>
        <strong>Como revogar o acesso da Conta Google:</strong> Você pode revogar imediatamente a permissão concedida ao aplicativo AnaheimHub acessando o painel de segurança da sua conta Google em{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          https://myaccount.google.com/permissions
        </a>{" "}
        (em &quot;Apps de terceiros com acesso à conta&quot;).
      </p>
      <p>
        <strong>Como solicitar a exclusão de dados:</strong> Para solicitar o encerramento da sua conta e a remoção completa de seus dados pessoais do sistema, envie uma solicitação com o assunto &quot;Exclusão de Dados&quot; para{" "}
        <a href={`mailto:${CONTACT_ADMIN}`} className="text-primary hover:underline">{CONTACT_ADMIN}</a> ou{" "}
        <a href={`mailto:${CONTACT_SUPPORT}`} className="text-primary hover:underline">{CONTACT_SUPPORT}</a>. Atendemos todas as solicitações no prazo máximo de até 15 (quinze) dias.
      </p>

      <h2>9. Segurança da Informação</h2>
      <p>
        Adotamos padrões elevados de proteção cibernética, incluindo tráfego integralmente criptografado sob protocolo HTTPS/TLS, certificados SSL emitidos por autoridade confiável, hashing de credenciais com fator de trabalho robusto, tokens de autenticação assinados digitalmente com expiração curta para links de recuperação, rate-limiting preventivo contra força bruta e blindagem de conexões de banco de dados.
      </p>

      <h2>10. Canais de Contato e DPO / Encarregado</h2>
      <p>
        Para esclarecer dúvidas sobre esta Política de Privacidade, relatar incidentes de segurança ou exercer qualquer um dos seus direitos de titular, entre em contato diretamente com nossa equipe de administração:
      </p>
      <ul>
        <li><strong>Administração & Privacidade:</strong> <a href={`mailto:${CONTACT_ADMIN}`} className="text-primary hover:underline">{CONTACT_ADMIN}</a></li>
        <li><strong>Suporte Comunitário:</strong> <a href={`mailto:${CONTACT_SUPPORT}`} className="text-primary hover:underline">{CONTACT_SUPPORT}</a></li>
      </ul>
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
