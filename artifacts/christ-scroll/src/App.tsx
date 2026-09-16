import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import { AppShell } from './components/layout/app-shell';
import Landing from './pages/landing';
import Onboarding from './pages/onboarding';
import Home from './pages/home';
import BibleBrowser from './pages/bible/browser';
import Reader from './pages/bible/reader';
import ExploreHub from './pages/explore/hub';
import Timeline from './pages/timeline/index';
// Placeholder imports for remaining pages to satisfy router
import PersonDetail from './pages/explore/person';
import PlaceDetail from './pages/explore/place';
import EventDetail from './pages/explore/event';
import JourneysList from './pages/journeys/list';
import JourneyDetail from './pages/journeys/detail';
import Profile from './pages/profile';
import Login from './pages/auth/login';
import Register from './pages/auth/register';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        {/* Un-shelled routes */}
        <Route path="/" component={Landing} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        {/* Shelled routes */}
        <Route path="/home">
          <AppShell><Home /></AppShell>
        </Route>
        <Route path="/bible">
          <AppShell><BibleBrowser /></AppShell>
        </Route>
        <Route path="/bible/:bookSlug/:chapter">
          <AppShell><Reader /></AppShell>
        </Route>
        <Route path="/explore">
          <AppShell><ExploreHub /></AppShell>
        </Route>
        <Route path="/people/:slug">
          <AppShell><PersonDetail /></AppShell>
        </Route>
        <Route path="/places/:slug">
          <AppShell><PlaceDetail /></AppShell>
        </Route>
        <Route path="/events/:slug">
          <AppShell><EventDetail /></AppShell>
        </Route>
        <Route path="/timeline">
          <AppShell><Timeline /></AppShell>
        </Route>
        <Route path="/journeys">
          <AppShell><JourneysList /></AppShell>
        </Route>
        <Route path="/journeys/:slug">
          <AppShell><JourneyDetail /></AppShell>
        </Route>
        <Route path="/me">
          <AppShell><Profile /></AppShell>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
