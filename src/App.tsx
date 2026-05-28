/* Design system reminder: Hangar Tático Neo-Militar — landing pública + portal interno modular. */
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
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

const DeckbuilderPage = lazy(() => import("@/pages/DeckbuilderPage"));
const StatsPage = lazy(() => import("@/pages/StatsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

function RouteLoader({ label }: { label: string }) {
  return <GlobalLoader label={`Abrindo ${label}`} />;
}

function LazyRoute({ label, children }: { label: string; children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoader label={label} />}>{children}</Suspense>;
}

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/portal" component={DashboardPage} />
        <Route path="/wishlist">{() => <BinderPage kind="WISHLIST" />}</Route>
        <Route path="/owned">{() => <BinderPage kind="OWNED" />}</Route>
        <Route path="/decks" component={PublicDecksPage} />
        <Route path="/deck/:shareId" component={SharedDeckPage} />
        <Route path="/binder/:shareId" component={SharedBinderPage} />
        <Route path="/sets/:code" component={SetDetailPage} />
        <Route path="/sets" component={CollectionsPage} />
        <Route path="/stats">{() => <LazyRoute label="Analytics"><StatsPage /></LazyRoute>}</Route>
        <Route path="/cards/:id" component={CardDetailPage} />
        <Route path="/cards" component={CardsPage} />
        <Route path="/rules/:id" component={RulingDetailPage} />
        <Route path="/rules" component={RulesPage} />
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
