/* Design system reminder: Hangar Tático Neo-Militar — landing pública + portal interno modular. */
import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
import AuthPage from "@/pages/AuthPage";
import TournamentsPage from "@/pages/TournamentsPage";

const DeckbuilderPage = lazy(() => import("@/pages/DeckbuilderPage"));
const StatsPage = lazy(() => import("@/pages/StatsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

function RouteLoader({ label }: { label: string }) {
  return <GlobalLoader label={`Abrindo ${label}`} />;
}

function LazyRoute({ label, children }: { label: string; children: ReactNode }) {
  return <Suspense fallback={<RouteLoader label={label} />}>{children}</Suspense>;
}

function RequireAuth({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    if (adminOnly && user?.role !== "ADMIN") {
      navigate("/portal", { replace: true });
    }
  }, [adminOnly, isAuthenticated, navigate, user?.role]);

  if (!isAuthenticated || (adminOnly && user?.role !== "ADMIN")) {
    return <GlobalLoader label="Validando acesso" />;
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/login" component={AuthPage} />
        <Route path="/portal">{() => <RequireAuth><DashboardPage /></RequireAuth>}</Route>
        <Route path="/wishlist">{() => <RequireAuth><BinderPage kind="WISHLIST" /></RequireAuth>}</Route>
        <Route path="/owned">{() => <RequireAuth><BinderPage kind="OWNED" /></RequireAuth>}</Route>
        <Route path="/decks" component={PublicDecksPage} />
        <Route path="/deck/:shareId" component={SharedDeckPage} />
        <Route path="/binder/:shareId" component={SharedBinderPage} />
        <Route path="/sets/:code" component={SetDetailPage} />
        <Route path="/sets" component={CollectionsPage} />
        <Route path="/database" component={CardsPage} />
        <Route path="/eventos" component={TournamentsPage} />
        <Route path="/stats">{() => <LazyRoute label="Analytics"><StatsPage /></LazyRoute>}</Route>
        <Route path="/tournaments" component={TournamentsPage} />
        <Route path="/cards/:id" component={CardDetailPage} />
        <Route path="/cards" component={CardsPage} />
        <Route path="/rules/:id" component={RulingDetailPage} />
        <Route path="/rules" component={RulesPage} />
        <Route path="/deckbuilder">{() => <RequireAuth><LazyRoute label="Deckbuilder"><DeckbuilderPage /></LazyRoute></RequireAuth>}</Route>
        <Route path="/profile">{() => <RequireAuth><ProfilePage /></RequireAuth>}</Route>
        <Route path="/u/:username" component={PublicProfilePage} />
        <Route path="/admin">{() => <RequireAuth adminOnly><LazyRoute label="Admin"><AdminPage /></LazyRoute></RequireAuth>}</Route>
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
