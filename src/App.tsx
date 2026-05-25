/* Design system reminder: Hangar Tático Neo-Militar — landing pública + portal interno modular. */
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
import DeckbuilderPage from "@/pages/DeckbuilderPage";
import AdminPage from "@/pages/AdminPage";
import ProfilePage from "@/pages/ProfilePage";
import PublicProfilePage from "@/pages/PublicProfilePage";
import SharedDeckPage from "@/pages/SharedDeckPage";
import PublicDecksPage from "@/pages/PublicDecksPage";
import CollectionsPage from "@/pages/CollectionsPage";
import SetDetailPage from "@/pages/SetDetailPage";
import StatsPage from "@/pages/StatsPage";
import NotFound from "@/pages/NotFound";

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/portal" component={DashboardPage} />
        <Route path="/decks" component={PublicDecksPage} />
        <Route path="/deck/:shareId" component={SharedDeckPage} />
        <Route path="/sets/:code" component={SetDetailPage} />
        <Route path="/sets" component={CollectionsPage} />
        <Route path="/stats" component={StatsPage} />
        <Route path="/cards/:id" component={CardDetailPage} />
        <Route path="/cards" component={CardsPage} />
        <Route path="/rules/:id" component={RulingDetailPage} />
        <Route path="/rules" component={RulesPage} />
        <Route path="/tournaments" component={TournamentsPage} />
        <Route path="/deckbuilder" component={DeckbuilderPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/u/:username" component={PublicProfilePage} />
        <Route path="/admin" component={AdminPage} />
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
