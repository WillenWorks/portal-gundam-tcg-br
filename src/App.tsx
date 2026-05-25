/* Design system reminder: Hangar Tático Neo-Militar — landing pública + portal interno modular. */
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "@/pages/Home";
import DashboardPage from "@/pages/DashboardPage";
import CardsPage from "@/pages/CardsPage";
import CardDetailPage from "@/pages/CardDetailPage";
import RulesPage from "@/pages/RulesPage";
import RulingDetailPage from "@/pages/RulingDetailPage";
import TournamentsPage from "@/pages/TournamentsPage";
import ProfilePage from "@/pages/ProfilePage";
import PublicProfilePage from "@/pages/PublicProfilePage";
import SharedDeckPage from "@/pages/SharedDeckPage";
import PublicDecksPage from "@/pages/PublicDecksPage";
import CollectionsPage from "@/pages/CollectionsPage";
import SetDetailPage from "@/pages/SetDetailPage";
import NotFound from "@/pages/NotFound";

const DeckbuilderPage = lazy(() => import("@/pages/DeckbuilderPage"));
const StatsPage = lazy(() => import("@/pages/StatsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

function RouteLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Carregamento sob demanda</p>
        <h1 className="mt-3 font-heading text-3xl uppercase">Abrindo {label}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          Esse módulo foi separado do bundle inicial para acelerar a entrada no portal e nas páginas públicas.
        </p>
      </div>
    </div>
  );
}

function LazyRoute({ label, children }: { label: string; children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoader label={label} />}>{children}</Suspense>;
}

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/portal" component={DashboardPage} />
        <Route path="/decks" component={PublicDecksPage} />
        <Route path="/deck/:shareId" component={SharedDeckPage} />
        <Route path="/sets/:code" component={SetDetailPage} />
        <Route path="/sets" component={CollectionsPage} />
        <Route path="/stats">{() => <LazyRoute label="Analytics"><StatsPage /></LazyRoute>}</Route>
        <Route path="/cards/:id" component={CardDetailPage} />
        <Route path="/cards" component={CardsPage} />
        <Route path="/rules/:id" component={RulingDetailPage} />
        <Route path="/rules" component={RulesPage} />
        <Route path="/tournaments" component={TournamentsPage} />
        <Route path="/deckbuilder">{() => <LazyRoute label="Deckbuilder"><DeckbuilderPage /></LazyRoute>}</Route>
        <Route path="/profile" component={ProfilePage} />
        <Route path="/u/:username" component={PublicProfilePage} />
        <Route path="/admin">{() => <LazyRoute label="Admin"><AdminPage /></LazyRoute>}</Route>
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
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
