import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { BookOpen, Compass, Home as HomeIcon, Map, User, Book } from 'lucide-react';

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: '/home', label: 'Home', icon: HomeIcon },
    { href: '/bible', label: 'Bible', icon: BookOpen },
    { href: '/explore', label: 'Explore', icon: Compass },
    { href: '/journeys', label: 'Journeys', icon: Map },
    { href: '/me', label: 'Profile', icon: User },
  ];

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        <div className="p-6">
          <Link href="/home" className="flex items-center gap-3 text-sidebar-foreground">
            <Book className="h-6 w-6 text-primary" />
            <span className="font-serif text-xl font-bold tracking-tight">The Scroll</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-4">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="mx-auto h-full w-full max-w-4xl">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-border bg-background px-2 pb-safe md:hidden">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? 'fill-primary/20' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
