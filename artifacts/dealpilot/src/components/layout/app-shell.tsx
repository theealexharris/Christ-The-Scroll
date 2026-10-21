import { BRAND } from "@workspace/dealpilot-core";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Briefcase, Compass, LayoutDashboard, LogOut, Menu, Plug, Settings, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "../ui/dialog";
import { Badge } from "../ui/primitives";

const NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/discover", label: "Discover deals", Icon: Compass },
  { href: "/deals", label: "Deal pipeline", Icon: Briefcase },
  { href: "/activity", label: "Activity", Icon: Activity },
  { href: "/integrations", label: "Integrations", Icon: Plug },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function isActive(location: string, href: string) {
  return href === "/" ? location === "/" : location === href || location.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md text-white">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav aria-label="Main" className="space-y-1">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(location, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-white/15 text-white" : "text-navy-100 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBox() {
  const { data } = useSession();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const user = data?.user as { email?: string; name?: string; isAnonymous?: boolean } | undefined;
  if (!user) return null;
  return (
    <div className="rounded-lg bg-white/5 p-3 text-sm text-navy-100">
      <div className="flex items-center gap-2">
        <UserRound className="size-4 shrink-0" aria-hidden />
        <span className="truncate" title={user.email}>
          {user.isAnonymous ? "Demo workspace" : user.email}
        </span>
      </div>
      {user.isAnonymous && (
        <Badge tone="amber" className="mt-2">
          Temporary demo account
        </Badge>
      )}
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          qc.clear();
          navigate("/login");
        }}
        className="mt-3 flex items-center gap-2 text-xs font-medium text-navy-200 hover:text-white"
      >
        <LogOut className="size-3.5" aria-hidden /> Sign out
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="no-print hidden w-64 shrink-0 flex-col gap-6 bg-navy-950 px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <Logo />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <UserBox />
      </aside>

      <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-navy-950 px-4 py-3 lg:hidden">
        <Logo />
        <Dialog open={open} onOpenChange={setOpen}>
          <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Open navigation menu">
            <Menu className="size-5" />
          </button>
          <DialogContent title="Menu" side="left" className="bg-navy-950 text-white [&_h2]:text-white">
            <div className="flex h-full flex-col gap-6">
              <NavLinks onNavigate={() => setOpen(false)} />
              <UserBox />
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
        <footer className="no-print mx-auto mt-12 flex max-w-7xl flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <Link href="/legal/disclaimer" className="hover:text-navy-800">
            Disclaimer
          </Link>
          <Link href="/legal/privacy" className="hover:text-navy-800">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-navy-800">
            Terms
          </Link>
        </footer>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm text-slate-500">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
