/* Design system reminder: Hangar Tático Neo-Militar — landing pública + portal interno modular. */
import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch, useLocation } from "wouter";
import { useHashLocationWithQuery } from "@/lib/hashLocationWithQuery";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FactionProvider } from "@/contexts/FactionContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GlobalLoader } from "@/components/layout/GlobalLoader";
import Home from "@/pages/Home";
import DashboardPage from "@/pages/DashboardPage";
import CardsPage from "@/pages/CardsPage";
import CardDetailPage from "@/pages/CardDetailPage";
import RulesPage from "@/pages/RulesPage";
import RulingDetailPage from "@/pages/RulingDetailPage";
import ProfilePage from "@/pages/ProfilePage";
import PublicProfilePage from "@/pages/PublicProfilePage";
import SharedDeckPage from "@/pages/SharedDeckPage";
import SharedBinderPage from "@/pages/SharedBinderPage";
import PublicDecksPage from "@/pages/PublicDecksPage";
import CollectionsPage from "@/pages/CollectionsPage";
import SetDetailPage from "@/pages/SetDetailPage";
import NotFound from "@/pages/NotFound";
import BinderPage from "@/pages/BinderPage";
import BinderListPage from "@/pages/BinderListPage";
import AuthPage from "@/pages/AuthPage";
import TournamentsPage from "@/pages/TournamentsPage";
import ChangelogPage from "@/pages/ChangelogPage";

const DeckbuilderPage = lazy(() => import("@/pages/DeckbuilderPage"));
const DeckListPage = lazy(() => import("@/pages/DeckListPage"));
const StatsPage = lazy(() => import("@/pages/StatsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const OrganizerPage = lazy(() => import("@/pages/OrganizerPage"));
const SimulatorSandboxPage = lazy(() => import("@/pages/SimulatorSandboxPage"));
const SimulatorMatchPage = lazy(() => import("@/pages/SimulatorMatchPage"));
// DEV-ONLY — preview de layout cru do simulador (docs/38, Frente 4). Em
// produção `import.meta.env.DEV` é `false` estático: o `import()` cai numa
// branch morta e o bundler remove o chunk; a rota abaixo também só monta em DEV.
const SimulatorLayoutPreviewPage = lazy(() =>
  import.meta.env.DEV
    ? import("@/pages/SimulatorLayoutPreviewPage")
    : Promise.resolve({ default: () => null }),
);

function RouteLoader({ label }: { label: string }) {
  return <GlobalLoader label={`Abrindo ${label}`} />;
}

function LazyRoute({ label, children }: { label: string; children: ReactNode }) {
  return <Suspense fallback={<RouteLoader label={label} />}>{children}</Suspense>;
}

function RequireAuth({ children, adminOnly = false, hosterOnly = false }: { children: ReactNode; adminOnly?: boolean; hosterOnly?: boolean }) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  // hosterOnly libera pra quem tem a flag isHoster (concedida pelo admin) OU é ADMIN
  // direto -- não é um degrau de role, é uma capacidade extra por fora.
  const deniedByHoster = hosterOnly && !(user?.isHoster || user?.role === "ADMIN");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    if (adminOnly && user?.role !== "ADMIN") {
      navigate("/portal", { replace: true });
      return;
    }
    if (deniedByHoster) {
      navigate("/portal", { replace: true });
    }
  }, [adminOnly, deniedByHoster, isAuthenticated, navigate, user?.role]);

  if (!isAuthenticated || (adminOnly && user?.role !== "ADMIN") || deniedByHoster) {
    return <GlobalLoader label="Validando acesso" />;
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Router hook={useHashLocationWithQuery}>
      <Switch>
        <Route path="/login" component={AuthPage} />
        <Route path="/portal">{() => <RequireAuth><DashboardPage /></RequireAuth>}</Route>
        <Route path="/binders">{() => <RequireAuth><BinderListPage /></RequireAuth>}</Route>
        <Route path="/binders/:id">{() => <RequireAuth><BinderPage /></RequireAuth>}</Route>
        <Route path="/decks" component={PublicDecksPage} />
        <Route path="/deck/:shareId" component={SharedDeckPage} />
        <Route path="/binder/:shareId" component={SharedBinderPage} />
        <Route path="/sets/:code" component={SetDetailPage} />
        <Route path="/sets" component={CollectionsPage} />
        <Route path="/database" component={CardsPage} />
        <Route path="/eventos" component={TournamentsPage} />
        <Route path="/novidades" component={ChangelogPage} />
        <Route path="/stats">{() => <LazyRoute label="Analytics"><StatsPage /></LazyRoute>}</Route>
        <Route path="/tournaments" component={TournamentsPage} />
        <Route path="/cards/:id" component={CardDetailPage} />
        <Route path="/cards" component={CardsPage} />
        <Route path="/rules/:id" component={RulingDetailPage} />
        <Route path="/rules" component={RulesPage} />
        <Route path="/deckbuilder">{() => <RequireAuth><LazyRoute label="Decks"><DeckListPage /></LazyRoute></RequireAuth>}</Route>
        <Route path="/deckbuilder/:id">{() => <RequireAuth><LazyRoute label="Deckbuilder"><DeckbuilderPage /></LazyRoute></RequireAuth>}</Route>
        <Route path="/profile">{() => <RequireAuth><ProfilePage /></RequireAuth>}</Route>
        <Route path="/organizador">{() => <RequireAuth hosterOnly><LazyRoute label="Organizador"><OrganizerPage /></LazyRoute></RequireAuth>}</Route>
        {/* Simulador Beta -- aberto a qualquer usuário logado (decisão do Willen, 2026-08-30); as rotas de servidor
            de depuração/admin continuam hosterRequired, mas o fluxo normal (fila) não precisa mais disso. */}
        <Route path="/simulador">{() => <RequireAuth><LazyRoute label="Simulador"><SimulatorSandboxPage /></LazyRoute></RequireAuth>}</Route>
        {/* Tela de partida dedicada (rodada visual, 2026-08-31) -- só o matchId; o assento é resolvido
            no servidor a partir do usuário logado (ver SimulatorMatchPage.tsx). */}
        <Route path="/simulador/partida/:matchId">
          {(params) => (
            <RequireAuth>
              <LazyRoute label="Partida">
                <SimulatorMatchPage matchId={params.matchId} />
              </LazyRoute>
            </RequireAuth>
          )}
        </Route>
        {/* DEV-ONLY, SEM auth — preview de layout cru pra validar a F4 em
            displays reais (docs/38). Não existe no build de produção. */}
        {import.meta.env.DEV && (
          <Route path="/simulador/preview-layout">
            {() => (
              <LazyRoute label="Preview de Layout">
                <SimulatorLayoutPreviewPage />
              </LazyRoute>
            )}
          </Route>
        )}
        <Route path="/u/:username" component={PublicProfilePage} />
        <Route path="/admin/:section">{() => <RequireAuth adminOnly><LazyRoute label="Gestão"><AdminPage /></LazyRoute></RequireAuth>}</Route>
        <Route path="/admin">{() => <RequireAuth adminOnly><LazyRoute label="Gestão"><AdminPage /></LazyRoute></RequireAuth>}</Route>
        <Route path="/">{() => <Home />}</Route>
        <Route path="/:section">{(params) => <Home targetSection={params.section} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <FactionProvider defaultFaction="hangar">
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <AppRouter />
            </TooltipProvider>
          </AuthProvider>
        </FactionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
