import { Link } from 'wouter';
import { Book, ChevronRight } from 'lucide-react';

export default function Landing() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background selection:bg-primary/20">
      {/* Navbar */}
      <header className="flex h-16 items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-2">
          <Book className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">
            Christ: The Scroll
          </span>
        </div>
        <Link
          href="/home"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign In
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center md:px-12">
        <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="font-serif text-5xl leading-[1.1] text-foreground md:text-7xl lg:text-8xl">
            The Living Word, <br />
            <span className="text-primary italic">Opened.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Read Scripture as it was meant to be experienced—a connected story of people, places, events, and the journey of God with humanity.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row pt-4">
            <Link
              href="/onboarding"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
            >
              Begin Your Journey
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/home"
              className="flex h-12 items-center justify-center rounded-full border border-border bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Continue Reading
            </Link>
          </div>
        </div>

        {/* Mockup / Visual */}
        <div className="mt-20 w-full max-w-5xl rounded-t-3xl border border-b-0 border-border bg-card p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 fill-mode-both md:p-8">
          <div className="aspect-[16/9] w-full rounded-2xl bg-muted overflow-hidden relative">
            {/* Minimal abstract representation of the app */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-secondary p-8 flex flex-col gap-6">
               <div className="h-8 w-1/3 rounded bg-primary/10" />
               <div className="space-y-3">
                 <div className="h-4 w-full rounded bg-border/50" />
                 <div className="h-4 w-5/6 rounded bg-border/50" />
                 <div className="h-4 w-4/6 rounded bg-border/50" />
               </div>
               <div className="mt-auto flex gap-4">
                  <div className="h-32 w-48 rounded-xl bg-card shadow-sm border border-border/50" />
                  <div className="h-32 w-48 rounded-xl bg-card shadow-sm border border-border/50" />
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
