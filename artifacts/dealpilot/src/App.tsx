import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, type ReactNode } from "react";
import { Toaster } from "sonner";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import ActivityPage from "@/pages/activity";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import DealPage from "@/pages/deal/deal-page";
import DealsPage from "@/pages/deals";
import DiscoverPage from "@/pages/discover";
import IntegrationsPage from "@/pages/integrations";
import LegalPage from "@/pages/legal";
import PrintReportPage from "@/pages/print-report";
import PropertyPage from "@/pages/property";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-navy-950">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">{this.state.error.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PrivateRoutes() {
  const { data, isPending } = useSession();
  const [location] = useLocation();
  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LoadingBlock label="Checking your session…" />
      </div>
    );
  }
  if (!data?.user) return <Redirect to={`/login?next=${encodeURIComponent(location)}`} />;
  return (
    <Switch>
      <Route path="/deals/:id/print" component={PrintReportPage} />
      <Route>
        <AppShell>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/discover" component={DiscoverPage} />
            <Route path="/properties/:id" component={PropertyPage} />
            <Route path="/deals" component={DealsPage} />
            <Route path="/deals/:id" component={DealPage} />
            <Route path="/activity" component={ActivityPage} />
            <Route path="/integrations" component={IntegrationsPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/legal/:page" component={LegalPage} />
            <Route>
              <div className="py-16 text-center">
                <h1 className="text-2xl font-semibold text-navy-950">Page not found</h1>
                <p className="mt-2 text-sm text-slate-600">The page you were looking for doesn't exist.</p>
              </div>
            </Route>
          </Switch>
        </AppShell>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/login">{() => <AuthPage mode="login" />}</Route>
          <Route path="/signup">{() => <AuthPage mode="signup" />}</Route>
          <Route path="/public/legal/:page" component={LegalPage} />
          <Route>
            <PrivateRoutes />
          </Route>
        </Switch>
        <Toaster richColors position="top-right" closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
